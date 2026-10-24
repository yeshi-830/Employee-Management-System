# Employee Management System (EMS)

This project is a full-stack employee management system built with a React + TypeScript frontend and an Express + TypeScript backend. It is designed as a practical HR application for managing employees, departments, leave requests, and dashboard analytics.

## Stack

- Frontend: React, Vite, TypeScript, React Router
- Styling: Tailwind CSS and reusable UI patterns
- Backend: Node.js, TypeScript, Express
- Database: MySQL 8 with Prisma ORM
- Auth: JWT + secure HTTP-only cookies with CSRF protection

## Quick start

1. Copy the example environment files:
   - `backend/.env.example` -> `backend/.env`
   - `frontend/.env.example` -> `frontend/.env`
2. Start MySQL locally with Docker:
   - `docker compose up -d mysql`
3. Apply Prisma schema to MySQL:
   - `cd backend`
   - `npm run db:push`
   - `npm run db:seed`
4. Start the backend:
   - `npm run dev`
5. Start the frontend in a second terminal:
   - `cd frontend`
   - `npm run dev -- --host 0.0.0.0`

## Demo login

Use the built-in seeded account:

- Email: `hr@northstar.example`
- Password: `Password123!`

## Project structure

- `frontend/`: React application
- `backend/`: Express API and Prisma schema
- `docker-compose.yml`: MySQL development database

## Beginner-friendly notes

- The frontend manages screens and user experience.
- The backend acts as the business rule layer and enforces access control.
- Prisma gives you a type-safe database layer and makes schema changes easier to review.
- JWT tokens are stored in secure cookies, while a CSRF token protects state-changing actions.
- We keep secrets in environment files instead of checking them into source control.

## Security and limitations

This is a demo that follows common secure patterns, but it is not a substitute for a production security review. Always validate with your hosting environment, network rules, and compliance requirements before using it in a live organization.
