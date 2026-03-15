import { render } from "preact";
import { useState, useEffect } from "preact/hooks";
import { createBrowserRouter, RouterProvider } from "react-router";
import CoursesList from "./coursesList";
import CourseUpdate from "./courseUpdate";
import LoginPage from "./loginPage";

import "./main.css";

const router = createBrowserRouter([
    {
        path: "/",
        Component: LoginPage
    },
    {
        path: "/courses",
        Component: CoursesList
    },
    {
        path: "/courses/:courseId",
        Component: CourseUpdate
    },
]);

render((
    <div className="w-9/10 max-w-4xl mx-auto">
        <RouterProvider router={router} />
    </div>
), document.getElementById("app")!);
