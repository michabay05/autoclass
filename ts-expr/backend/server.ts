import express from "express";
import session from "express-session";
import {google} from "googleapis";
import passport from "passport";
import "./auth";

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
        res.redirect("http://localhost:5173")
    }
);

app.get("/api/current-user", (req, res) => {
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
        res.json(response.data.courses || [])
    } catch (error) {
        console.error("Classroom API Error:", error);
        res.status(500).json({"error":
            "Failed to fetch courses from Google Classroom"})
    }
});

app.listen(3000, () => {
    console.log("Server listening on port 3000...");
});
