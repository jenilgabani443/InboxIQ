# 📧 InboxIQ – Gmail-Inspired Email Management Platform

<div align="center">

![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript)
![Node.js](https://img.shields.io/badge/Node.js-339933?logo=node.js)
![Express.js](https://img.shields.io/badge/Express.js-000000?logo=express)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?logo=mongodb)
![License](https://img.shields.io/badge/License-MIT-blue)

A modern Gmail-inspired full-stack email management platform built using **Next.js, Node.js, Express.js, MongoDB, and REST APIs** with secure authentication, advanced email organization, powerful search, notifications, and a responsive user experience.

</div>

---

# ✨ Features

## 🔐 Authentication & Security

- Secure User Registration & Login
- JWT Authentication
- Protected Routes
- User Profile Management
- Change Password
- Secure Password Management

---

## 📧 Email Management

- Inbox
- Sent
- Drafts
- Archive
- Trash
- Compose Email
- Email Detail View
- Draft Editing
- Automatic Mark as Read
- Restore Email
- Delete Forever
- Responsive Split View

---

## 🏷 Email Organization

- Labels
- Apply / Remove Labels
- Filter Emails by Labels
- Archive Emails
- Trash Management
- Read Status Management

---

## 🔍 Advanced Search

- Real-time Search
- Gmail-style Search Operators
- Search by Subject
- Search by Sender
- Search by Recipient
- Search by Email Content
- Search History
- Saved Searches
- Rename Saved Search
- Delete Saved Search
- Clear Search History

---

## 🔔 Notifications

- Notification Center
- Unread Notification Badge
- Mark Notification as Read
- Mark All Notifications as Read
- Delete Notifications

---

## ⚙ User Settings

- Profile Management
- Change Password
- Email Signature
- Vacation Responder
- Theme Preferences
- Notification Preferences
- Undo Send Preference

---

## 🎨 User Experience

- Responsive Desktop & Mobile UI
- Split Pane Email Layout
- Optimistic UI Updates
- Loading Skeletons
- Empty States
- Error Handling
- Toast Notifications
- Modern ShadCN UI Components

---

# 🛠 Tech Stack

## Frontend

- Next.js
- React.js
- TypeScript
- Tailwind CSS
- ShadCN UI
- Zustand
- Axios

## Backend

- Node.js
- Express.js
- MongoDB
- Mongoose
- JWT Authentication
- REST APIs
- Redis
- Bull Queue
- Cloudinary

---

# 📂 Project Structure

```text
InboxIQ
│
├── backend
│   ├── config
│   ├── controllers
│   ├── middleware
│   ├── models
│   ├── routes
│   ├── services
│   ├── validators
│   └── utils
│
├── frontend
│   ├── app
│   ├── components
│   ├── services
│   ├── store
│   ├── hooks
│   ├── lib
│   └── types
│
└── README.md
```

---

# 🚀 Implemented Modules

| Module | Status |
|---------|--------|
| Authentication | ✅ |
| Inbox | ✅ |
| Compose Email | ✅ |
| Sent Folder | ✅ |
| Drafts | ✅ |
| Archive | ✅ |
| Trash | ✅ |
| Labels | ✅ |
| Advanced Search | ✅ |
| Search History | ✅ |
| Saved Searches | ✅ |
| Notifications | ✅ |
| User Settings | ✅ |
| Profile Management | ✅ |
| Change Password | ✅ |
| Vacation Responder | ✅ |
| Email Signature | ✅ |

---

# 🔒 Security

- JWT Authentication
- Password Hashing
- Protected REST APIs
- Request Validation
- Centralized Error Handling

---

# ⚡ Performance

- Debounced Search
- AbortController Request Cancellation
- Optimistic UI Updates
- Efficient Zustand State Management
- Responsive Rendering

---

# 📱 Responsive Design

InboxIQ is fully responsive and optimized for:

- 💻 Desktop
- 📱 Mobile
- 📟 Tablet

Desktop features a split-pane email layout, while mobile provides a full-screen navigation experience.

---

# 💻 Installation

## Clone Repository

```bash
git clone https://github.com/jenilgabani443/InboxIQ.git
```

## Backend

```bash
cd backend
npm install
npm run dev
```

## Frontend

```bash
cd frontend
npm install
npm run dev
```

---

# 🔧 Environment Variables

```env
PORT=

MONGO_URI=

JWT_SECRET=

JWT_REFRESH_SECRET=

REDIS_URL=

CLOUDINARY_CLOUD_NAME=

CLOUDINARY_API_KEY=

CLOUDINARY_API_SECRET=
```

---

# 🧪 Verification

```bash
npm run build

npm run lint

npx tsc --noEmit
```

---

# 🚧 Known Limitations

The current backend does not provide APIs for:

- Starred Folder Retrieval
- Snoozed Folder Retrieval

These features can be added once backend support becomes available.

---

# 👨‍💻 Author

**Jenil Gabani**

Computer Science Engineering  
Nirma University

GitHub: https://github.com/jenilgabani443

---


# 📄 License

This project is licensed under the MIT License.
