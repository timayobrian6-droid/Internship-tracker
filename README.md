# InternConnect - Internship Management Platform

InternConnect is a comprehensive web application that connects students with internship opportunities and helps companies manage their hiring pipeline efficiently.

## What It Does

InternConnect provides a complete internship management solution with:
- **Student Portal**: Browse and apply to internships, track applications, build profiles
- **Company Portal**: Post openings, manage applications, track hiring progress
- **Admin Dashboard**: System-wide analytics and user management
- **Real-time Updates**: Live application status tracking for all users

## Problem It Solves

**For Students:**
- **Information Overload**: Scattered internship listings across multiple platforms
- **Lost Applications**: No centralized tracking of application status
- **Poor Communication**: Delayed or missing feedback from companies
- **Inefficient Process**: Manual follow-ups and status checks

**For Companies:**
- **Application Management**: Overwhelming volume of applications to organize
- **Communication Gaps**: Difficulty coordinating between hiring team members
- **Progress Tracking**: Lack of visibility into hiring pipeline stages
- **Time-Consuming Process**: Manual status updates and candidate communication

InternConnect solves these by providing a unified platform where students can easily find and track opportunities, while companies can efficiently manage their entire hiring workflow.

## Student Frontend Guide

### Getting Started
1. Visit the application and click "First Time User"
2. Register as a Student with your email and password
3. Complete your profile with education, skills, and preferences

### Dashboard Tab
- **Overview**: See your application statistics and recent activity
- **Quick Actions**: Apply to recommended internships, update profile
- **Notifications**: View important updates about your applications

### Profile Tab
- **Personal Information**: Update contact details and basic info
- **Education**: Add schools, degrees, GPA, and graduation dates
- **Skills & Experience**: List technical skills, projects, and work experience
- **Resume Upload**: Upload your resume/CV for applications
- **Preferences**: Set location preferences, salary expectations, and job types

### Openings Tab
- **Browse Internships**: Search and filter available positions
- **Filters**: Location, company, salary range, job type, skills required
- **Job Details**: View full job descriptions, requirements, and company info
- **Save for Later**: Bookmark interesting opportunities
- **Apply**: Submit applications directly through the platform

### Applications Tab
- **Application History**: View all your submitted applications
- **Status Tracking**: See current stage (Applied, Screening, Interview, Offer, etc.)
- **Company Communication**: View messages and updates from companies
- **Withdraw Applications**: Remove applications if you change your mind

## Company Frontend Guide

### Getting Started
1. Register as a Company with your email and password
2. Complete your company profile with business information
3. Start posting internship openings

### Dashboard Tab
- **Overview Metrics**: Total applications, active openings, hiring progress
- **Recent Activity**: New applications, upcoming interviews, recent hires
- **Quick Stats**: Application volume, conversion rates, time-to-hire

### Profile Tab
- **Company Information**: Business details, industry, company size
- **Contact Information**: Hiring manager details and contact methods
- **Company Description**: About your company and culture
- **Logo & Branding**: Upload company logo and set branding preferences

### Openings Tab
- **Create New Opening**: Post new internship positions
- **Job Details**: Title, description, requirements, salary, location
- **Application Settings**: Application deadlines, required documents
- **Edit Existing**: Modify active job postings
- **Close/Open Positions**: Control application acceptance

### Applications Tab (Kanban Pipeline)
- **Applied**: New applications awaiting review
- **Screening**: Initial candidate evaluation
- **Interview**: Scheduled and completed interviews
- **Offer**: Extended job offers
- **Hired**: Successfully placed candidates
- **Rejected**: Unsuccessful applications

**Pipeline Features:**
- Drag and drop applications between stages
- Add notes and feedback for each candidate
- Schedule interviews and track outcomes
- Send automated status updates to candidates
- Export candidate data for record keeping

### Analytics Tab
- **Hiring Metrics**: Success rates, time-to-hire, application volume
- **Candidate Insights**: Popular skills, education levels, locations
- **Pipeline Efficiency**: Bottlenecks and optimization opportunities
- **Custom Reports**: Generate CSV/PDF reports for management

## Deployment Instructions

## Deployment Instructions

### GitHub Codespaces (Recommended for Development)

#### Phase 1: Automatic Startup (Should happen automatically)
When you create a new Codespace, both backend and frontend should start automatically on ports 5000 and 3000.

#### Phase 2: Manual Installation (Run if dependencies aren't installed)
If the services don't start, first install dependencies:

```bash
# Step 1: Install backend dependencies
npm ci

# Step 2: Install frontend dependencies
npm --prefix internship-frontend ci
```

#### Phase 3: Manual Startup (Run if services don't start automatically)
If services still don't start after installation, run these commands:

```bash
# Step 1: Start backend server (runs on port 5000)
npm run dev

# Step 2: In a NEW terminal tab, start frontend (runs on port 3000)
npm --prefix internship-frontend start
```

**Order to follow:**
1. **Wait for automatic startup** (usually takes 1-2 minutes)
2. **If that fails** → Run Phase 2 installation commands
3. **If installation succeeds but services don't start** → Run Phase 3 startup commands
4. **Access your app** at `http://localhost:3000` (frontend) or `http://localhost:5000` (backend)

**Copy and paste these commands one by one** when setting up a new Codespace.

### Local Development
```bash
# Install dependencies
npm install
cd internship-frontend && npm install && cd ..

# Start the application
npm start
```

This runs both backend and frontend in single-port mode at `http://localhost:3001`

### Production Deployment

#### Manual Server Deployment
1. Set up Node.js server (version 16+)
2. Clone repository and install dependencies
3. Configure environment variables (copy `.env.example` to `.env`)
4. Build frontend: `cd internship-frontend && npm run build`
5. Start server: `npm start`
6. Configure reverse proxy (nginx) for production

#### Environment Variables Required
- `DATABASE_URL`: SQLite database path
- `JWT_SECRET`: Random string for authentication
- `PORT`: Server port (default: 3001)

### Database Setup
The application uses SQLite. On first run, it automatically:
- Creates database schema
- Applies any pending migrations

For production, ensure proper backup procedures are in place.
