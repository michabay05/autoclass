import express from "express";
import session from "express-session";
import {google} from "googleapis";
import passport from "passport";
import "./auth";
import {saveTimingConf} from "./process";

import type { Course } from "../common/types";
import {
    CourseState, ItemKind, ItemState, getCourseState, getItemState
} from "../common/types";

const app = express();
app.use(express.json());
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    // NOTE: Secure implies https. Since this is still in local dev,
    // I'm not going to use https
    cookie: { secure: false }
}))
app.use(passport.initialize());
app.use(passport.session());

app.get("/auth/google", passport.authenticate("google"));

app.get("/auth/google/failure", (req, res) => {
    res.send("Failed to authenticate...");
});

app.get(process.env.GOOGLE_REDIRECT_URI as string,
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
                creationDate: new Date(course.creationTime)
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
            kind: ItemKind.ASSIGNMENT,
            courseId: item.courseId,
            id: item.id,
            title: item.title,
            description: item.description,
            state: getItemState(item.state),
            creationTime: new Date(item.creationTime),
        }));

        // 4. Normalize Materials
        const materials = rawMaterials.map(mat => ({
            kind: ItemKind.MATERIAL,
            courseId: mat.courseId,
            id: mat.id,
            title: mat.title,
            description: mat.description,
            state: getItemState(mat.state),
            creationTime: new Date(mat.creationTime),
        }));

        // 5. Merge and sort by creation time (newest first)
        const combinedContent = [...assignments, ...materials].sort(
            (a, b) => b.creationTime - a.creationTime
        );

        // 6. Send to the client
        res.json(combinedContent);

    } catch (error) {
        console.error("Error fetching classroom data:", error);
        res.status(500).json({ error: "Failed to fetch course content" });
    }
});

app.post("/api/items", googleClassroomAuth, async (req, res) => {
    console.log(req.body);
    await saveTimingConf(req.body, "ex.json");
    res.status(200).json({msg: "received body and save it"});
});

app.listen(3000, () => {
    console.log("Server listening on port 3000...");
});
