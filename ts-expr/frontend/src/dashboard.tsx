import { useState, useEffect } from "preact/hooks";

enum CourseState {
    Active,
    Archived,
    Declined,
    Idk
}

interface Course {
    id: string;
    name: string;
    section: string;
    state: CourseState;
    creationDate: Date;
}

export default function Dashboard() {
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
                const coursesJSON = await res.json();
                const courses: Course[] = [];
                coursesJSON.map(course => {
                    courses.push({
                        id: course.id,
                        name: course.name,
                        section: course.section,
                        state: getCourseState(course.courseState),
                        creationDate: Date.parse(course.creationTime)
                    });
                });
                console.log(courses);
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
            {allCourses.map((course, i) => <Course key={i} {...course} />)}
        </div>
    </>
};

// id: string;
// name: string;
// section: string;
// state: CourseState;
// creationDate: Date;
const Course = (props: Course) => {
    return <div>
        <Link to="/">
            {`Id: ${props.id} | ${props.name} | ${props.state}`}
        </Link>
    </div>
};

const getCourseState = (stateStr: string): CourseState => {
    switch (stateStr) {
        case "ACTIVE"  : return CourseState.Active; break;
        case "ARCHIVED": return CourseState.Archived; break;
        case "DECLINED": return CourseState.Declined; break;
        default: throw new Error(`Unknown state str: ${stateStr}`);
    }
}
