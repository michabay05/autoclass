import express from "express";
import session from "express-session";
import {google} from "googleapis";
import passport from "passport";
import "./auth";

import {
    CourseState, Course, getCourseState,
    ItemKind, getItemState
} from "../common/types";

const app = express();
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}))
app.use(passport.initialize());
app.use(passport.session());

app.get("/auth/google", passport.authenticate("google"));

app.get("/auth/google/failure", (req, res) => {
    res.send("Failed to authenticate...");
});

app.get(process.env.GOOGLE_REDIRECT_URI,
    passport.authenticate("google", {
        failureRedirect: "/auth/google/failure"
    }),
    (req, res) => {
        res.redirect("http://localhost:5173/courses")
    }
);

app.get("/api/user-info", (req, res) => {
    res.send(req.user || null)
});

const googleClassroomAuth = (req, res, next) => {
    if (!req.user || !req.user.accessToken) {
        return res.status(401).json({"error": "Unauthorized Missing Google Tokens"})
    }

    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
    );

    oauth2Client.setCredentials({
        access_token: req.user.accessToken,
        refresh_token: req.user.refreshToken
    });

    req.classroom = google.classroom({ version: "v1", auth: oauth2Client })

    // Move onto the next route handler
    next();
}

app.get("/api/courses", googleClassroomAuth, async (req, res) => {
    try {
        const response = await req.classroom.courses.list({
            pageSize: 10,
        });

        const outCourses: Course[] = []
        for (const course of response.data.courses) {
            outCourses.push({
                id: course.id,
                name: course.name,
                section: course.section,
                state: getCourseState(course.courseState),
                creationDate: Date.parse(course.creationTime)
            });
        }
        res.json(outCourses || [])
    } catch (error) {
        console.error("Classroom API Error:", error);
        res.status(500).json({"error":
            "Failed to fetch courses from Google Classroom"})
    }
});

app.get("/api/items/:courseId", googleClassroomAuth, async (req, res) => {
    try {
        const courseId = req.params.courseId;
        const PAGE_SIZE = 150;
        const states = ["PUBLISHED", "DRAFT"]; // Ignoring "DELETED"

        // 1. Fetch Assignments and Materials concurrently
        const [courseWorkRes, materialsRes] = await Promise.all([
            req.classroom.courses.courseWork.list({
                courseId: courseId,
                pageSize: PAGE_SIZE,
                courseWorkStates: states
            }),
            req.classroom.courses.courseWorkMaterials.list({
                courseId: courseId,
                pageSize: PAGE_SIZE,
                courseWorkMaterialStates: states
            })
        ]);

        // 2. Safely extract the data (fixing that original undefined error!)
        const rawAssignments = courseWorkRes?.data?.courseWork || [];
        const rawMaterials = materialsRes?.data?.courseWorkMaterial || [];

        // 3. Normalize Assignments
        const assignments = rawAssignments.map(item => ({
            kind: ItemKind.Assignment,
            courseId: item.courseId,
            id: item.id,
            title: item.title,
            description: item.description,
            state: getItemState(item.state),
            creationTime: Date.parse(item.creationTime),
        }));

        // 4. Normalize Materials
        const materials = rawMaterials.map(mat => ({
            kind: ItemKind.Material,
            courseId: mat.courseId,
            id: mat.id,
            title: mat.title,
            description: mat.description,
            state: getItemState(mat.state),
            creationTime: Date.parse(mat.creationTime),
        }));

        // 5. Merge and sort by creation time (newest first)
        const combinedContent = [...assignments, ...materials].sort(
            (a, b) => b.creationTime - a.creationTime
        );
        console.log(materials.length);
        console.log(assignments.length);
        console.log(combinedContent.length);

        // 6. Send to the client
        res.json(combinedContent);

    } catch (error) {
        console.error("Error fetching classroom data:", error);
        res.status(500).json({ error: "Failed to fetch course content" });
    }
});

app.listen(3000, () => {
    console.log("Server listening on port 3000...");
});
