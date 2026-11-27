
(async function () {

    // Hide the page while checking authentication
    document.documentElement.style.visibility = "hidden";

    // Get Supabase connection
    const supabase = window.supabaseClient;

    if (!supabase) {
        window.location.href = "login.html";
        return;
    }

    try {

        // Check whether a student is logged in
        const { data: sessionData, error: sessionError } =
            await supabase.auth.getSession();

        if (sessionError || !sessionData.session) {
            window.location.href = "login.html";
            return;
        }

        const user = sessionData.session.user;

        // Retrieve the student's profile
        const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("full_name, grade_level, semester, grading_period")
            .eq("id", user.id)
            .maybeSingle();

        if (profileError) {
            throw profileError;
        }

        // Check whether profile setup is complete
        if (
            !profile ||
            profile.grade_level === null ||
            profile.semester === null ||
            profile.grading_period === null
        ) {
            window.location.href = "profile.html";
            return;
        }

        // Synchronize student information
        localStorage.setItem("aralyticsUserProfile", JSON.stringify({
            fullName: profile.full_name,
            grade: profile.grade_level,
            semester: profile.semester,
            period: profile.grading_period
        }));

        localStorage.setItem(
            "aralyticsCurrentGrade",
            profile.grade_level
        );

        localStorage.setItem(
            "aralyticsCurrentSemester",
            profile.semester
        );

        localStorage.setItem(
            "aralyticsCurrentPeriod",
            profile.grading_period
        );

        // Allow the page to appear
        document.documentElement.style.visibility = "visible";

    } catch (error) {

        console.error("Authentication error:", error);

        // Return to login if authentication cannot be verified
        window.location.href = "login.html";

    }

})();
