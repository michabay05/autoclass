import { useState, useEffect } from "preact/hooks";
import { Navigate } from "react-router";

export default function LoginPage() {
    const [loginSuccess, setLoginSuccess] = useState<boolean>(false);
    const [loading, setLoading] = useState<boolean>(false);

    useEffect(() => {
        fetch("/api/user-info", {
            credentials: "include"
        }).then(res => res.json())
        .then(data => {
            setLoginSuccess(true);
            setLoading(false);
        })
        .catch(err => {
            console.log("Failed to fetch user");
            setLoginSuccess(false);
            setLoading(false);
        });
    }, [])

    const redirectToLogin = () => {
        window.location.href = "/auth/google"
        setLoading(true);
    };

    if (loading) return <div>"Loading..."</div>;

    return <>
        {loginSuccess
        ? <Navigate to={"/courses"} replace />
        : (
            <button onClick={redirectToLogin}
                className="bg-red-300 rounded px-5 py-3 m-4 cursor-pointer"
            >Login with Google</button>
        )}
    </>
};
