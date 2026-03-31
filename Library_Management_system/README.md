# Library Management System

A beginner-friendly, premium-designed library management web application built with Python Flask and SQLite.

## Features
- **Admin**: Dashboard statistics, add/edit/delete books, issue books to students, process returned books.
- **Student**: View issued books alongside current fines, search for available books.
- **Automated Fine Processing**: Calculates overdue fines based on the due date.

## Tech Stack
- Frontend: HTML5, Custom CSS Variables, Vanilla JS
- Backend: Python Flask
- Database: SQLite (Raw queries to maximize beginner learning)

## Setup
1. Clone the repository.
2. Initialize virtual environment:
   `python3 -m venv venv`
3. Activate the environment:
   `source venv/bin/activate`  # Linux/Mac
   `venv\Scripts\activate`     # Windows
4. Install dependencies:
   `pip install -r requirements.txt`
5. Run the application:
   `python app.py`

## Default Users
- Admin: `admin` / `admin123`
- Student: `student` / `student123`
