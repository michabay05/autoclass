import { render } from "preact";
import { useState, useEffect } from "preact/hooks";
import App from "./app"

interface UserInfo {
    name: string;
    email: string;
}

const AppWrapper = () => {
    const [user, setUser] = useState<UserInfo | null>(null);
    const [loading, setLoading] = useState<boolean>(false);

    useEffect(() => {
        fetch("/api/current-user", {
            credentials: "include"
        }).then(res => res.json())
        .then(data => {
            setUser(data);
            setLoading(false);
        })
        .catch(err => {
            console.log("Failed to fetch user");
            setLoading(false);
        });
    }, [])

    const printContent = () => {
        fetch("/api/courses", {
            credentials: "include"
        }).then(res => res.json())
        .then(data => {
            console.log(data);
        })
        .catch(err => {
            console.log("Failed to fetch user");
            setLoading(false);
        });
    };

    const redirectToLogin = () => {
        window.location.href = "/auth/google"
        setLoading(true);
    };

    if (loading) return <div>"Loading..."</div>;

    if (user) printContent()

    return <>
        {user
        ? "Playing around..."
        // ? <App />
        : (
            <button onClick={redirectToLogin}
                className="bg-red-300 rounded px-5 py-3 m-4 cursor-pointer"
            >Login with Google</button>
        )}
    </>
};

render(<AppWrapper />, document.getElementById("app")!);
