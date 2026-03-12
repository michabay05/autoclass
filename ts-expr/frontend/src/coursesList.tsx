import { useState, useEffect } from "preact/hooks";
import { ChevronRight } from "lucide-react";
import { Link } from "react-router";
import { CourseState } from "../../common/types";
import type { Course } from "../../common/types";

export default function CoursesList() {
    const [email, setEmail] = useState<string>("unknown@unknown.com");
    const [allCourses, setAllCourses] = useState<Course[]>([]);

    useEffect(() => {
        const fetchUserInfo = async () => {
            try {
                const res = await fetch("/api/user-info", {credentials: "include"});
                const userJSON = await res.json();
                console.log(userJSON);
                setEmail(userJSON.email);
            } catch (error) {
                console.error(error);
            }
        };

        const fetchCourses = async () => {
            try {
                const res = await fetch("/api/courses", {credentials: "include"});
                const courses = await res.json();
                console.log(">>", courses);
                setAllCourses(courses);
            } catch (error) {
                console.error(error);
            }
        }

        fetchUserInfo();
        fetchCourses();
    }, []);

    return <>
        <h1 className="text-center text-2xl font-bold my-5">
            All Courses under {email}
        </h1>
        <div>
            {allCourses.map((course, i) => <CourseItem key={i} {...course} />)}
        </div>
    </>
};

const CourseItem = (props: Course) => {
    return <Link to={`/courses/${props.id}`} state={props}>
        <div className="bg-indigo-300 my-2 px-6 py-4 rounded border-3
        border-indigo-600 flex justify-between items-center">
            <div>
                <p>{props.name}</p>
                <span className={`w-auto border-3 rounded-3xl px-1 text-xs`}>
                    {CourseState[props.state]}</span>
            </div>
            <ChevronRight />
        </div>
    </Link>
};
