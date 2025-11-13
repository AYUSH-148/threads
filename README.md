# 🧵 Threads – A Modern Social Media Platform

A full-stack **social networking application** built with **Next.js 14**, enabling users to create threads, tag other users, form organizations, and engage through likes, comments, and shares — all with a **modern UI and secure authentication**.

---

## 💡 System Architecture Overview

This application follows a modern, server-side-centric architecture leveraging the **Next.js 14 App Router** and **Server Actions**.

* **Frontend (UI):** Built with React components, styled with **Tailwind CSS** and **Shadcn UI**.
* **Backend Logic:** Handled primarily by **Next.js Server Actions** (for mutation/API logic) and **REST APIs** for specific needs, ensuring fast data fetching and mutations.
* **Database:** **MongoDB** is used for flexible, NoSQL data storage, accessed via the **Mongoose ORM**.
* **Authentication:** **Clerk** manages all user authentication (sign-in, sign-up, sessions) and identity, while **Clerk webhooks** enable real-time synchronization between Clerk's user data and the MongoDB application database.
* **File Storage:** **UploadThing** provides secure and reliable file (media) uploads.

---

## 🚀 Features

* 🧑‍🤝‍🧑 **Thread-based interaction** – Create, comment, like, share, and tag users in posts.
* 🏢 **Organization & community support** – Form or join organizations and collaborate on public or private threads.
* 🔒 **Secure authentication** – Powered by **Clerk**, supporting sign-in, sign-up, and session management.
* 📸 **Media uploads** – Integrated with **UploadThing** for fast and reliable file uploads.
* ⚡ **Real-time updates** – Listen to events via **Clerk webhooks** for a dynamic user experience.
* 🎨 **Elegant UI** – Built with **TailwindCSS** and **Shadcn UI**, ensuring responsive and accessible design.
* 🧠 **Data validation & forms** – Using **Zod** and **React Hook Form** for robust validation and form handling.
* 🏗️ **Scalable architecture** – Designed with reusable components and clean folder structures for maintainability.

---

## 🧩 Tech Stack

| Category | Technologies |
| :--- | :--- |
| **Frontend** | Next.js 14, React, TypeScript, TailwindCSS, Shadcn UI |
| **Backend** | Next.js Server Actions, REST APIs |
| **Database** | MongoDB (Mongoose ORM) |
| **Auth** | Clerk Authentication & Webhooks |
| **File Uploads** | UploadThing |
| **Validation** | Zod, React Hook Form |
| **Version Control** | Git, GitHub |
| **Deployment** | Vercel |

---

## 🏁 Getting Started

Follow these steps to set up and run the project locally.

### 1️⃣ Clone the repository & Install Dependencies

Open your terminal and execute the following:

```bash
git clone [https://github.com/AYUSH-148/threads.git](https://github.com/AYUSH-148/threads.git)
cd threads
npm install # or yarn install or pnpm install
