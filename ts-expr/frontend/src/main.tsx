import { render } from "preact";
import { useState, useEffect } from "preact/hooks";
import { createBrowserRouter, RouterProvider } from "react-router";
import CoursesList from "./coursesList";
import CourseUpdate from "./courseUpdate";
import LoginPage from "./loginPage";

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

render(<RouterProvider router={router} />, document.getElementById("app")!);
