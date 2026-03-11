import passport from "passport";
import {Strategy as GoogleStrategy} from "passport-google-oauth20";
import dotenv from "dotenv";
dotenv.config();

const SCOPE_LIST: string[] = [
    "https://www.googleapis.com/auth/classroom.courses",
    "https://www.googleapis.com/auth/classroom.topics",
    "https://www.googleapis.com/auth/classroom.coursework.students",
    "https://www.googleapis.com/auth/classroom.courseworkmaterials",
    "https://www.googleapis.com/auth/classroom.coursework.me",
    "https://www.googleapis.com/auth/drive.readonly",
    "profile", "email"
]

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_REDIRECT_URI,
    scope: SCOPE_LIST,
    state: true,
}, (accessToken, refreshToken, profile, cb) => {
    try {
        const user = {
            name: profile.displayName,
            accessToken: accessToken,
            refreshToken: refreshToken
        };

        // console.log("Profile:", profile);
        return cb(null, user);
    } catch (error) {
        console.log("Strat error:", error);
        return cb(error, null);
    }
}));

passport.serializeUser((user, cb) => {
    process.nextTick(() => {
        return cb(null, user);
    });
});

passport.deserializeUser((user, cb) => {
    process.nextTick(() => {
        return cb(null, user);
    });
});
