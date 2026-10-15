# Planeo

A project and team-tracking web app. Managers create projects, set milestones,
and assign people with weekly hours. Everyone can see what they're working on,
what's due soon, and what changed recently.

<!-- Add screenshots here, e.g.:
![Dashboard](docs/screenshots/dashboard.png)
-->

## Features

- **Sign-in and role-based access.** Admin, Manager, and Employee roles, enforced on the backend
- **Projects.** Create, edit, archive, and restore projects, each with its own detail view
- **Milestones (deliverables).** Track due dates, status and progress, with dependency chains across projects and reminders for upcoming deadlines
- **People and assignments.** Assign team members to projects and track weekly hours. Anyone booked over 40 hours a week is flagged as over-allocated
- **Budgets.** Planned budget per project against what's been spent: labour (hours worked × hourly rate) plus logged expenses, with a forecast at finish
- **Risk detection.** Projects are flagged when milestones are overdue or blocked, progress falls behind the time used, spending is over or forecast to go over budget, or nobody is assigned
- **Activity log.** An audit trail of who changed what
- **Notifications, search, and filters** on every page
- **Responsive layout** for desktop and mobile

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, Vite, plain CSS |
| Backend | Java 21 on AWS Lambda (Gson, JDBC) |
| Database | PostgreSQL (Amazon RDS) |
| Infrastructure | Terraform: S3, CloudFront, Lambda, RDS |

### Backend layout

```
backend/javaCode/src/main/java/com/tracker/
├── controller/   # request routing and endpoint handlers
├── security/     # password hashing, tokens, access policy
├── repository/   # SQL access per entity
├── model/        # domain types
└── dto/          # request/response shapes
```

## Running locally

### Frontend only (fake data, no backend needed)

```bash
cd frontend
npm install
echo "VITE_USE_FAKE_DATA=true" > .env.development.local
npm run dev
```

Sign in with any demo user from
[`fakeData.js`](frontend/src/services/fake/fakeData.js), for example
`avery@example.com` / `password123`.

### Full stack

```bash
cd backend/javaCode && mvn clean package
```

Deployment uses the Terraform config in [`infra/`](infra/) and the scripts in
[`bin/`](bin/). See [`infra/README.md`](infra/README.md) for details.

## Credits

Built on the [Citi coding workshop](https://github.com/citi/coding-workshop-participant)
starter template, which provided the infrastructure scaffolding and deployment
scripts. The original workshop brief is in [`docs/WORKSHOP.md`](docs/WORKSHOP.md).
The application code (frontend pages and components, Java backend, and infra
fixes) is my own work.

## License

Apache 2.0. See [LICENSE](LICENSE).
