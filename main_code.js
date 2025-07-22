import cors from "cors";
import express, { json } from "express";
import { Schema, connect, model } from "mongoose";

const PORT = 3000;

const app = express();
app.use(cors());
app.use(json());

// Section schema
const SectionSchema = new Schema({
    _id: String,
    timetable: [[String]], // 2D array of strings
    allocationMap: {
        type: Map,
        of: [[Number]], // Array of [row, col] positions
        default: () => new Map(), // Ensure default is a valid Map
    },
});

const Section = model("Section", SectionSchema);

const isSafe = (row, col, timetable, subject) => {
    if (timetable[row][col] !== ".") return false;

    let columnCount = 0;
    timetable.forEach((rowArr) => {
        if (rowArr[col] === subject) {
            columnCount++;
        }
    });
    if (columnCount >= 1) return false;

    if (timetable[row].includes(subject)) return false;

    return true;
};
const shuffleArray = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]]; // Swap elements
    }
};

const isRowEmptyInCols = (timetable, row, startCol, endCol) => {
    let val = true;
    for (let col = startCol; col <= endCol; col++) {
        if (timetable[row][col] !== ".") {
            val = false;
            break;
        }
    }
    return val;
};

// ✅ Faculty Conflict Check for Labs
// const checkPrevLabs = (allSections, item, row, startCol, endCol, facultyIds) => {
//     for (let allsec of allSections) {
//         if (allsec._id !== item.section) {
//             for (let [secSubjects, positions] of allsec.allocationMap.entries()) {
//                 let otherFacultyIds = secSubjects.split(",");

//                 const hasConflict = facultyIds.some((id) => otherFacultyIds.includes(id));
//                 if (!hasConflict) continue;

//                 for (let [r, c] of positions) {
//                     if (r === row && c >= startCol && c <= endCol) {
//                         return false;
//                     }
//                 }
//             }
//         }
//     }
//     return true;
// };

const checkPrev = (allSections, item, row, col, subject) => {
    for (let allsec of allSections) {
        if (allsec._id !== item.section) {
            for (let [secSubjects, positions] of allsec.allocationMap.entries()) {
                if (secSubjects !== subject) continue;
                for (let [r, c] of positions) {
                    if (r === row && c === col) {
                        return false;
                    }
                }
            }
        }
    }
    return true;
};



const allocateLab = (sectionId, facultyIds, timetable, allocationMap, allSections, item, book, count_lab) => {
    console.log(`🔹 Allocating lab for faculty: ${facultyIds} in section ${sectionId._id}`);

    let allocated = false;
    const sectionNumber = Number(sectionId._id);
    const isEvenSection = sectionNumber % 2 === 0;

    const morningLimit = isEvenSection ? 3 : 2;
    const afternoonLimit = isEvenSection ? 2 : 3;

    const labSlots = [
        { startCol: 0, limitType: "morning" },
        { startCol: 3, limitType: "afternoon" },
    ];

    let rows = [0, 1, 2, 3, 4];
    shuffleArray(rows);

    for (let { startCol, limitType } of labSlots) {
        const limitReached = (limitType === "morning" && count_lab[0] >= morningLimit) ||
            (limitType === "afternoon" && count_lab[1] >= afternoonLimit);

        if (limitReached) continue;

        for (let row of rows) {
            const endCol = startCol + 2;

            // Conflict check
            let hasConflict = false;
            for (let otherSection of allSections) {
                if (otherSection._id !== sectionId._id) {
                    const otherAllocations = otherSection.allocationMap.get(facultyIds.toString()) || [];
                    if (otherAllocations.some(([r, c]) => r === row && c >= startCol && c <= endCol)) {
                        hasConflict = true;
                        break;
                    }
                }
            }

            if (hasConflict) {
                console.log(`⚠️ Faculty ${facultyIds} is already teaching at row ${row}, skipping.`);
                continue;
            }

            if (
                isRowEmptyInCols(timetable, row, startCol, endCol) &&
                book[row] === 0
            ) {
                console.log(`✅ Allocated lab in row ${row}, cols ${startCol}-${endCol}`);

                for (let i = 0; i < 3; i++) {
                    timetable[row][startCol + i] = facultyIds.join(",");
                }

                if (!allocationMap.has(facultyIds.toString())) {
                    allocationMap.set(facultyIds.toString(), []);
                }
                allocationMap.get(facultyIds.toString()).push(
                    [row, startCol],
                    [row, startCol + 1],
                    [row, startCol + 2]
                );

                if (limitType === "morning") count_lab[0]++;
                else count_lab[1]++;

                book[row] = -1;
                allocated = true;
                break;
            }
        }

        if (allocated) break;
    }

    if (!allocated) {
        console.log(`⚠️ Lab allocation failed for faculty: ${facultyIds}. Attempting reallocation.`);
        reallocateLab(sectionId, facultyIds, timetable, allocationMap, allSections, item);
    }

    sectionId.timetable = timetable;
    sectionId.allocationMap = allocationMap;
};


const reallocateLab = async (
    sectionId,
    facultyIds,
    timetable,
    allocationMap,
    allSections,
    item
) => {
    console.log(`Reallocating lab for faculty: ${facultyIds}`);
    let allocated = false;

    // Check if reallocation is needed and proceed with reallocation logic
    for (let row = 0; row < timetable.length; row++) {
        for (let col = 0; col < timetable[row].length; col++) {
            // Check if the slot is available
            if (timetable[row][col] === ".") {
                let conflict = false;

                // Check for conflicts with other faculty allocations
                for (let otherSection of allSections) {
                    if (otherSection._id !== sectionId._id) {
                        const otherAllocations = otherSection.allocationMap.get(facultyIds.toString()) || [];
                        if (otherAllocations.some(([r, c]) => r === row && c === col)) {
                            conflict = true;
                            break;
                        }
                    }
                }

                if (!conflict) {
                    // No conflict, allocate the slot
                    timetable[row][col] = facultyIds.join(",");
                    allocationMap.set(facultyIds.toString(), [
                        ...(allocationMap.get(facultyIds.toString()) || []),
                        [row, col],
                    ]);
                    allocated = true;
                    break;
                }
            }
        }
        if (allocated) break;
    }

    if (allocated) {
        console.log(`✅ Lab successfully reallocated for faculty: ${facultyIds}`);
    } else {
        console.log(`⚠️ Failed to reallocate lab for faculty: ${facultyIds}`);
    }

    sectionId.timetable = timetable;
    sectionId.allocationMap = allocationMap;
};



const reallocate = async (
    isLab,
    allocationCount,
    allocationMap,
    currsubject,
    sectionId,
    timetable,
    allSections,
    item
) => {
    const keysArray = Array.from(allocationMap.keys());
    let idx = 2;

    while (idx <= keysArray.length) {
        const lastKey = keysArray[keysArray.length - idx];
        console.log("I am in reallocate method. Current Key:", lastKey);

        if (isLab) {
            console.log(`Skipping reallocation for lab: ${lastKey}`);
            idx++;
            continue;
        }

        const values = allocationMap.get(lastKey);
        console.log("Values are:", values);

        if (!values || values.length === 0) {
            console.error("No positions found for lastKey:", lastKey);
            idx++;
            continue;
        }

        console.log("Current subject:", currsubject);

        let allocated = false;
        for (let row = 0; row < timetable.length && !allocated; row++) {
            for (let col = 0; col < timetable[row].length && !allocated; col++) {
                if (timetable[row][col] === ".") {
                    for (let i = 0; i < values.length && !allocated; i++) {
                        const [r, c] = values[i];
                        console.log("r:", r, "c:", c, "row:", row, "col:", col);

                        timetable[r][c] = ".";
                        if (
                            isSafe(r, c, timetable, currsubject) &&
                            checkPrev(allSections, item, r, c, currsubject) &&
                            isSafe(row, col, timetable, lastKey) &&
                            checkPrev(allSections, item, row, col, lastKey)
                        ) {
                            console.log("In isSafe for subject:", lastKey);

                            timetable[r][c] = currsubject;
                            timetable[row][col] = lastKey;

                            allocationCount++;
                            allocationMap.set(currsubject, [
                                ...(allocationMap.get(currsubject) || []),
                                [r, c],
                            ]);
                            allocationMap.set(
                                lastKey,
                                [
                                    ...(allocationMap.get(lastKey) || []),
                                    [row, col],
                                ].filter(([vr, vc]) => !(vr === r && vc === c))
                            );

                            console.log(`Swapped: (${r}, ${c}) with (${row}, ${col})`);

                            sectionId.timetable = timetable;
                            sectionId.allocationMap = allocationMap;
                            break;
                        } else {
                            timetable[r][c] = lastKey;
                        }
                    }
                    idx++;
                }
                if (allocationCount === 3) break;
            }
        }

        if (allocationCount === 3) break;
    }
};


const allocateSec = async (
    sectionId,
    faculties,
    isLab,
    allocationMap,
    timetable,
    book,
    count_lab,
    allSections,
    item
) => {

    console.log(`type....${typeof (faculties)}`)
    //console.log(`Starting allocation for faculties: ${faculties.join(', ')}, isLab: ${isLab}`);
    if (isLab) {
        console.log(`🔷 Lab Allocation for faculties: ${faculties}`);
        allocateLab(sectionId, faculties, timetable, allocationMap, allSections, item, book, count_lab);
    } else {
        console.log(`Allocating non - lab subject: ${faculties}`);
        let allocationCount = 0;
        const subject = faculties.toString();

        for (let row = 0; row < timetable.length; row++) {
            for (let col = 0; col < timetable[row].length; col++) {
                if (
                    isSafe(row, col, timetable, subject) &&
                    checkPrev(allSections, item, row, col, subject)
                ) {
                    timetable[row][col] = subject;
                    allocationCount++;
                    console.log(
                        `Allocated subject: ${subject} at row: ${row}, col: ${col}`
                    );

                    if (!allocationMap.has(subject)) allocationMap.set(subject, []);
                    allocationMap.get(subject).push([row, col]);

                    if (allocationCount === 3) break;
                }
            }

            if (allocationCount === 3) {
                break;
            }
        }

        sectionId.timetable = timetable;
        sectionId.allocationMap = allocationMap;

        if (allocationCount < 3) {
            console.log(
                `Subject: ${subject} allocation incomplete.Attempting reallocation.`
            );
            await reallocate(
                isLab,
                allocationCount,
                allocationMap,
                subject,
                sectionId,
                timetable,
                allSections,
                item
            );
            sectionId.timetable = timetable;
            sectionId.allocationMap = allocationMap;
        }

        console.log(`Allocation completed for non - lab subject: ${subject}`);
    }

    return { timetable, allocationMap };
};

app.post("/allocate", async (req, res) => {
    console.log("Received allocation request");
    const data = req.body;
    console.log("data is ", data)
    try {
        for (const item of data) {
            console.log(`Processing section: ${item.section}${typeof (item.section)}`);
            let sec = await Section.findById(item.section);
            if (!sec) {
                console.log(`Section: ${item.section} not found. Initializing.`);
                const initialTimetable = Array.from({ length: 5 }, () => Array(6).fill("."));
                sec = new Section({
                    _id: item.section,
                    timetable: initialTimetable,
                });
                await sec.save();
            }

            const book = new Array(5).fill(0);
            const count_lab = new Array(2).fill(0);
            const timetable = sec.timetable;
            let allocationMap = sec.allocationMap || new Map();
            const allSections = await Section.find();

            const labSubjects = item.orderedSubjects.filter((sub) => sub.isLab);
            const nonLabSubjects = item.orderedSubjects.filter((sub) => !sub.isLab);
            //console.log("type..............", typeof (facultyId))
            console.log("lab facultyIds")
            for (const { facultyId, isLab } of labSubjects) {
                console.log("..................", facultyId, "....................")
            }
            console.log("nonlab facultyIds")
            for (const { facultyId, isLab } of nonLabSubjects) {
                console.log("..................", facultyId, "....................")
            }
            for (const { facultyId, isLab } of labSubjects) {
                await allocateSec(
                    sec,
                    facultyId,
                    isLab,
                    allocationMap,
                    timetable,
                    book,
                    count_lab,
                    allSections,
                    item
                );
            }

            for (const { facultyId, isLab } of nonLabSubjects) {
                await allocateSec(
                    sec,
                    facultyId,
                    isLab,
                    allocationMap,
                    timetable,
                    book,
                    count_lab,
                    allSections,
                    item
                );
            }

            await sec.save();
            console.log("Allocation completed for section:", item.section);
            console.table(timetable);
            console.log("allocation map...........", allocationMap)

        }
        const allSections = await Section.find({}, { _id: 1, timetable: 1 });
        const timetable = allSections.timetable;  // Access the timetable array of objects
        console.log("timetable", timetable);
        res.status(200).json({ message: "Allocation successful" });
        console.log("Allocation request processed successfully");
    } catch (err) {
        console.error("Error during allocation:", err);
        res.status(500).json({
            message: "Error occurred during allocation",
            error: err.message,
        });
    }
});


//! get the section timetable display
app.get("/tt/:sectionId", async (req, res) => {
    const { sectionId } = req.params;
    try {

        const section = await Section.findById(sectionId);
        if (!section) {
            return res.status(404).json({ message: "Section not found" });
        }
        res.status(200).json({ timetable: section.timetable, allocationMap: section.allocationMap });
        //res.status(200).json({ timetable: section.timetable });
    } catch (err) {
        console.error("Error fetching timetable:", err);
        res.status(500).json({ message: "Error occurred while fetching timetable", error: err.message });
    }
});


//!  get the individual faculty timetable
app.get("/ft/:facultyId", async (req, res) => {
    const { facultyId } = req.params;
    console.log("📌 Received facultyId request:", facultyId);
    try {
        // Create a blank faculty timetable
        const facultyTimetable = Array(5).fill(null).map(() => Array(6).fill("."));

        // Fetch all sections
        const sections = await Section.find();

        sections.forEach((section) => {
            const allocationMap = section.allocationMap;

            console.log("🗺️ Checking allocationMap for faculty:", facultyId, "=>", allocationMap);

            // Iterate over all stored faculty allocations
            allocationMap.forEach((positions, key) => {
                const facultyIdsInKey = key.split(",");
                if (facultyIdsInKey.includes(facultyId)) {  // ✅ Check if facultyId exists in a multi-faculty key
                    console.log(`✅ Faculty ${facultyId} found in ${key}, positions:`, positions);
                    positions.forEach(([row, col]) => {
                        facultyTimetable[row][col] = section._id; // ✅ Store section ID in timetable
                    });
                }
            });
        });

        console.log("📋 Final faculty timetable:", facultyTimetable);
        res.json({ facultyTimetable });

    } catch (error) {
        console.error("❌ Error fetching faculty timetable:", error);
        res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
});




// MongoDB connection and server start
connect("mongodb://localhost:27017/school", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
    .then(() => {
        console.log("Connected to MongoDB");
        app.listen(3000, () => {
            console.log("Server is running on port http://localhost:5500");
        });
    })
    .catch((error) => {
        console.error("MongoDB connection error:");
    });