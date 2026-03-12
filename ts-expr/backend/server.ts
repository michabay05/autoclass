import express from "express";
import session from "express-session";
import {google} from "googleapis";
import passport from "passport";
import "./auth";
import {applyChanges} from "./process";

import type { Course } from "../common/types";
import {
    CourseState, ItemKind, getCourseState
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

app.get("/api/rawItems/:courseId", googleClassroomAuth, async (req, res) => {
    try {
        const courseId: string = req.params.courseId;
        // NOTE: I made this higher because I don't want to deal with
        // pagination and next page tokens
        const PAGE_SIZE: number = 250;
        const states: string[] = ["PUBLISHED", "DRAFT"]; // Ignoring "DELETED"

        const [topicsRes, courseWorkRes, materialsRes] = await Promise.all([
            req.classroom.courses.topics.list({
                courseId: courseId,
                pageSize: PAGE_SIZE,
            }),
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

        res.json({
            rawTopics: topicsRes?.data?.topic || [],
            rawAssignments: courseWorkRes?.data?.courseWork || [],
            rawMaterials: materialsRes?.data?.courseWorkMaterial || [],
        })
    } catch (error) {
        console.error("Error fetching topic data:", error);
        res.status(500).json({ error: "Error fetching topic data" });
    }
});

app.post("/api/apply", googleClassroomAuth, async (req, res) => {
    await applyChanges(req.classroom, req.body);
});

app.listen(3000, () => {
    console.log("Server listening on port 3000...");
});
