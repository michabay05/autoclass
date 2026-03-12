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
    clientID: process.env.GOOGLE_CLIENT_ID as string,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    callbackURL: process.env.GOOGLE_REDIRECT_URI as string,
    scope: SCOPE_LIST,
    state: true,
}, (accessToken: string, refreshToken: string, profile, cb) => {
    try {
        const user = {
            name: profile._json.name,
            email: profile._json.email,
            accessToken: accessToken,
            refreshToken: refreshToken
        };

        console.log("Profile:", profile);
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
