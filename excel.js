document.addEventListener("DOMContentLoaded", () => {
    // Helper function for POST request

    let sectionMap = new Map(); // Map<SecId, Map<FacultyId, [{ subjectId, isLab }]>>
    let excelDataToSend = [];   // 👈 Add this line to store parsed data
    const storedMap = JSON.parse(localStorage.getItem("sectionMap"));
    if (storedMap) {
        sectionMap = new Map(
            storedMap.map(([sectionId, facultyObj]) => [
                sectionId,
                new Map(Object.entries(facultyObj)),
            ])
        );
        console.log("✅ Reconstructed sectionMap from localStorage:", sectionMap);
    }

    async function sendDataToServer(data) {
        try {
            const response = await fetch("http://localhost:3000/allocate", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(data),
            });

            if (response.ok) {
                const result = await response.json();
                console.log("Server response:", result);
                alert("Data successfully sent to the server!");

                // ✅ Save the sectionMap to localStorage
                if (sectionMap && sectionMap instanceof Map) {
                    const serializedMap = Array.from(sectionMap.entries()).map(
                        ([sectionId, facultyMap]) => [
                            sectionId,
                            Object.fromEntries(facultyMap), // Convert inner Map to plain object
                        ]
                    );
                    localStorage.setItem("sectionMap", JSON.stringify(serializedMap));
                    console.log("✅ sectionMap stored in localStorage:", serializedMap);
                } else {
                    console.warn("⚠️ sectionMap is not defined or not a Map.");
                }

            } else {
                const error = await response.json();
                console.error("Server error:", error);
                alert("Error occurred while sending data to the server.");
            }
        } catch (err) {
            console.error("Network error:", err);
            alert("Failed to connect to the server.");
        }
    }


    // Helper function for GET request
    // ! fetching timetable for section
    async function fetchDataFromServer(sectionMap) {
        console.log("I am in the method");
        const sectionId = document.getElementById("sectionId").value; // Get section ID from input
        const timetableContainer = document.getElementById("timetableContainer");

        timetableContainer.innerHTML = ""; // Clear any previous timetable
        console.log("Fetching timetable for section:", sectionId);
        console.log("in get", sectionMap);

        try {
            const response = await fetch(`http://localhost:3000/tt/${sectionId}`); // Fetch timetable for the entered section ID

            if (!response.ok) {
                const error = await response.json();
                timetableContainer.innerHTML = `<p style="color: red;">${error.message}</p>`;

                // ✅ REMOVE from localStorage and sectionMap if section not found
                if (response.status === 404) {
                    console.warn(`Section '${sectionId}' not found. Removing from localStorage.`);
                    sectionMap.delete(sectionId); // Remove from sectionMap

                    // Remove from localStorage
                    let stored = localStorage.getItem("sectionMap");
                    if (stored) {
                        const parsed = JSON.parse(stored);
                        const updated = parsed.filter(([id]) => id !== sectionId);
                        localStorage.setItem("sectionMap", JSON.stringify(updated));
                    }
                }
                return;
            }

            const { timetable, allocationMap } = await response.json();
            console.log("tt is ", timetable);

            // let timetable = jsonResponse.timetable;
            console.log("Timetable data type:", Array.isArray(timetable)); // Should return true if it's an array
            //console.log("Timetable:", timetable);
            timetable.forEach((row, index) => {
                console.log(`Row ${index}:`, row);
            });

            console.log("tt is ", timetable);

            if (!timetable || timetable.length === 0) {
                timetableContainer.innerHTML = `<p>No timetable found for section ID: ${sectionId}</p>`;
                return;
            }

            const table = document.createElement("table");
            const headerRow = document.createElement("tr");

            const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]; // Days of the week

            // Create the first column header for the days of the week
            const dayHeader = document.createElement("th");
            dayHeader.textContent = "Day/Period";
            headerRow.appendChild(dayHeader);

            // Create period headers
            const periods = [
                "9:00-10:00",
                "10:00-11:00",
                "11:10-12:10",
                "12:55-1:55",
                "1:55-2:55",
                "2:55-3:45",
            ];
            periods.forEach((period) => {
                const th = document.createElement("th");
                th.textContent = period;
                headerRow.appendChild(th);
            });

            table.appendChild(headerRow);

            // Add rows from the timetable
            timetable.forEach((row, index) => {
                const tableRow = document.createElement("tr");

                // Add day of the week (Monday to Friday)
                const dayCell = document.createElement("td");
                dayCell.textContent = days[index] || ""; // Add the day (e.g., Monday, Tuesday...)
                tableRow.appendChild(dayCell);
                //console.log(sectionMap)
                row.forEach((cell) => {
                    const td = document.createElement("td");
                    const sid = sectionMap.get(sectionId);
                    cell = cell.split(',')[0];
                    console.log(cell);
                    console.log(sid);
                    console.log(sid.has(cell));
                    // Get the faculty ID assigned to this cell
                    if (sid && sid.has(cell)) {
                        console.log("inner cell ", cell)
                        console.log(sid.get(cell));
                        const [subjectId, isLab] = sid.get(cell);
                        console.log("sub id..", subjectId.subjectId, "type of..", typeof (subjectId), "cell..", sid.get(cell));
                        td.textContent = subjectId.subjectId; // Display subject ID
                    } else {
                        td.textContent = "."; // Empty cell
                    }


                    tableRow.appendChild(td);
                });

                table.appendChild(tableRow);
            });

            timetableContainer.appendChild(table); // Append the table to the container
        } catch (error) {
            console.error("Error fetching timetable:", error);
            timetableContainer.innerHTML = `<p style="color: red;">An error occurred. Please try again later.</p>`;
        }
    }

    //! fetching timtebale for the individual faculty
    async function fetchTimetable() {
        const facultyId = document.getElementById("subIdInput").value.trim();
        if (!facultyId) {
            alert("Please enter a Subject ID.");
            return;
        }

        try {
            const response = await fetch(`http://localhost:3000/ft/${facultyId}`);

            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }

            const data = await response.json();
            console.log(data)
            if (
                !data ||
                !data ||
                data.length === 0
            ) {
                alert("No timetable found for this subject.");
                return;
            }
            console.log(data.facultyTimetable);
            displayTimetable(data.facultyTimetable);
        } catch (error) {
            alert("Error fetching timetable: " + error.message);
            console.error("Fetch error:", error);
        }
    }

    // !displaying for individual faculty timetable
    function displayTimetable(timetableData) {
        const facultyTableContainer = document.getElementById("facultytable");
        facultyTableContainer.innerHTML = ""; // Clear previous table content

        // Create table element
        const table = document.createElement("table");

        // Create table header
        const headerRow = document.createElement("tr");

        // Days of the week for the first column
        const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

        // Create the first column header for the days of the week
        const dayHeader = document.createElement("th");
        dayHeader.textContent = "Day/Period";
        headerRow.appendChild(dayHeader);

        // Create period headers
        const periods = [
            "9:00-10:00",
            "10:00-11:00",
            "11:10-12:10",
            "12:55-1:55",
            "1:55-2:55",
            "2:55-3:45",
        ];
        periods.forEach((period) => {
            const th = document.createElement("th");
            th.textContent = period;
            headerRow.appendChild(th);
        });

        table.appendChild(headerRow);

        // Create a 5x6 empty grid (5 rows for days, 6 columns for periods)
        const timetableGrid = Array.from({ length: 5 }, () => Array(6).fill(""));
        console.log(timetableData);
        timetableData.forEach((row, rowIndex) => {
            row.forEach((cellValue, colIndex) => {
                timetableGrid[rowIndex][colIndex] = cellValue !== '.' ? cellValue : ""; // Replace '.' with an empty string
            });
        });

        // Populate the table with the timetable grid
        timetableGrid.forEach((row, rowIndex) => {
            const tr = document.createElement("tr");

            // Add the day (Monday to Friday) to the first column
            const dayCell = document.createElement("td");
            dayCell.textContent = daysOfWeek[rowIndex]; // Get the day based on row index
            tr.appendChild(dayCell);

            // Add the period slots (columns)
            row.forEach((cell) => {
                const td = document.createElement("td");
                td.textContent = cell || ""; // If no sectionId, leave the cell empty
                tr.appendChild(td);
            });

            table.appendChild(tr);
        });

        // Append the table to the facultytable div
        facultyTableContainer.appendChild(table);
        table.style.display = "table"; // Display the table
    }

    // Page-specific logic
    if (document.title === "Sending") {
        // Logic for the page where data is sent to the server
        const addSubjectButton = document.getElementById("addSubject");
        const sendDataButton = document.getElementById("sendData");
        const excelInput = document.getElementById("excelInput");
        const outputElement = document.getElementById("output");

        // let sectionMap = new Map(); // Map<SecId, Map<FacultyId, [{ subjectId, isLab }]>>

        //!Excel Upload Handler

        // let excelDataToSend = [];   // 👈 Add this line to store parsed data

        excelInput.addEventListener("change", function (e) {
            const file = e.target.files[0];
            const reader = new FileReader();

            reader.onload = function (e) {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: "array" });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(sheet);
                console.log("✅ Parsed Excel data:", jsonData);

                const formatted = {};

                jsonData.forEach((row) => {
                    const section = row["Section ID"];
                    const facultyId = row["Faculty ID"];
                    const subjectId = row["Subject ID"];
                    const isLab = row["Is Lab?"] === "Yes";

                    if (!formatted[section]) formatted[section] = {};
                    if (!formatted[section][facultyId]) formatted[section][facultyId] = [];

                    formatted[section][facultyId].push({
                        subjectId,
                        isLab,
                        facultyId: [facultyId],
                    });
                });

                const dataToSend = Object.entries(formatted).map(([section, facultyMap]) => {
                    const subjectMap = new Map();

                    for (const [facultyId, subjects] of Object.entries(facultyMap)) {
                        subjects.forEach(({ subjectId, isLab }) => {
                            if (!subjectMap.has(subjectId)) {
                                subjectMap.set(subjectId, {
                                    facultyId: [],
                                    isLab: isLab,
                                });
                            }
                            subjectMap.get(subjectId).facultyId.push(facultyId);
                        });
                    }

                    // ✅ Build sectionMap for localStorage
                    const innerMap = new Map();
                    for (const [facultyId, subjects] of Object.entries(facultyMap)) {
                        innerMap.set(facultyId, subjects);
                    }
                    sectionMap.set(section, innerMap);

                    return {
                        section: section,
                        orderedSubjects: Array.from(subjectMap.values()),
                    };
                });


                excelDataToSend = dataToSend; // Store for sending later
                alert("Excel file loaded successfully. Now click 'Send Data' to send it to the server.");
                // Save sectionMap to localStorage here as well
                const serializedMap = Array.from(sectionMap.entries()).map(
                    ([sectionId, facultyMap]) => [
                        sectionId,
                        Object.fromEntries(facultyMap),
                    ]
                );
                localStorage.setItem("sectionMap", JSON.stringify(serializedMap));
                console.log("✅ sectionMap stored in localStorage:", serializedMap);

            };

            reader.readAsArrayBuffer(file);
        });

        // ✅ Trigger sending only on button click
        sendDataButton.addEventListener("click", () => {
            if (excelDataToSend.length > 0) {
                sendDataToServer(excelDataToSend);
            } else {
                alert("Please upload an Excel file first.");
            }
        });


    } else if (document.title === "Fetching Student Timetable") {
        // Logic for the page where data is fetched from the server
        console.log("i am in fetching");
        const fetchDataButton = document.getElementById("timetableForm");
        // GET Page
        const storedSectionMap = localStorage.getItem("sectionMap");

        if (storedSectionMap) {
            try {
                const parsedData = JSON.parse(storedSectionMap);
                console.log("Parsed sectionMap from localStorage:", parsedData);

                if (Array.isArray(parsedData)) {
                    sectionMap = new Map(
                        parsedData.map(([sectionId, facultyObj]) => [
                            sectionId,
                            new Map(Object.entries(facultyObj)), // Convert inner Object back to Map
                        ])
                    );
                    console.log("Successfully reconstructed Section Map:", sectionMap);
                } else {
                    console.error(
                        "Invalid data format in localStorage for sectionMap. Expected an array."
                    );
                    sectionMap = new Map(); // Reset to empty Map if invalid data is found
                }
            } catch (error) {
                console.error("Error parsing sectionMap from localStorage:", error);
                sectionMap = new Map(); // Reset in case of parsing failure
            }
        }

        fetchDataButton.addEventListener("submit", (event) => {
            event.preventDefault();
            fetchDataFromServer(sectionMap); // Now it will have the correct data
        });
    } else if (document.title === "Faculty Timetable") {
        document.getElementById("btn").addEventListener("click", (event) => {
            event.preventDefault();
            fetchTimetable();
        });
    }
});
