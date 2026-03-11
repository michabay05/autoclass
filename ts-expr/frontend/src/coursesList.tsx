import { useState, useEffect } from "preact/hooks";
import { Link } from "react-router";
import { CourseState } from "../../common/types";
import type { Course } from "../../common/types";

export default function CoursesList() {
    const [displayName, setDisplayName] = useState<string>("");
    const [allCourses, setAllCourses] = useState<Course[]>([]);

    useEffect(() => {
        const fetchUserInfo = async () => {
            try {
                const res = await fetch("/api/user-info", {credentials: "include"});
                const userJSON = await res.json();
                setDisplayName(userJSON.name);
            } catch (error) {
                console.error(error);
            }
        };

        const fetchCourses = async () => {
            try {
                const res = await fetch("/api/courses", {credentials: "include"});
                const courses = await res.json();
                setAllCourses(courses);
            } catch (error) {
                console.error(error);
            }
        }

        fetchUserInfo();
        fetchCourses();
    }, []);

    return <>
        <h1>{displayName}</h1>
        <div>
            {allCourses.map((course, i) => <CourseItem key={i} {...course} />)}
        </div>
    </>
};

const CourseItem = (props: Course) => {
    return <div>
        <Link to={`/courses/${props.id}`} state={props}>
            {`Id: ${props.id} | ${props.name} | ${props.state}`}
        </Link>
    </div>
};
