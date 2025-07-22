# 🗓️ Automated Timetable Generator

This project is an intelligent timetable generator that automatically allocates slots for classes, labs, and faculty based on pre-defined inputs. Designed for educational institutions, it streamlines scheduling and prevents clashes between faculty, rooms, and time slots.

## 🚀 Features

- 📘 Auto-generates timetables based on constraints
- 👩‍🏫 Prevents faculty clash and lab overlap
- 🏫 Separate handling for theory and lab sessions
- 💡 Command-line based input/output
- 🧠 Logic-based implementation for allocation
- 📊 Output displayed in structured tabular format

## 📂 Project Structure

Automated-timetable-generator/
│
├── allocate.js # Main file for timetable logic and allocation
├── Lab.js # Lab-specific slot allocation
├── InputData.json # Input file with course, faculty, lab, slot data
├── timetable.json # Output timetable file
├── README.md # This file
└── package.json # Node.js config and dependencies


## ⚙️ Technologies Used

- 🟨 Node.js
- 🟫 JavaScript (ES6)
- 📄 JSON for input/output

## 🛠️ How to Run

**Clone the repository**
   ```bash
   git clone https://github.com/Architha-05/Automated-timetable-generator.git
   cd Automated-timetable-generator

Install Dependencies

npm install

Run the Timetable Generator

node allocate.js Lab.js

View Output

The generated timetable will be available in timetable.json

