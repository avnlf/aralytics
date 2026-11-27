
// Aralytics Database Helper
// Handles Supabase operations for student academic data.

(function () {
    const supabase = window.supabaseClient;

    if (!supabase) {
        console.error("Supabase connection not found.");
        return;
    }

    // Get the currently authenticated user.
    async function getCurrentUser() {
        const { data, error } = await supabase.auth.getUser();

        if (error) throw error;
        if (!data.user) {
            throw new Error("You must be logged in.");
        }

        return data.user;
    }

    // Get the currently selected academic context.
    function getAcademicContext() {
        const grade = Number(localStorage.getItem("aralyticsCurrentGrade"));
        const semester = Number(localStorage.getItem("aralyticsCurrentSemester"));
        const period = localStorage.getItem("aralyticsCurrentPeriod");

        if (
            !Number.isInteger(grade) || grade < 7 || grade > 12 ||
            ![1, 2].includes(semester) ||
            !["Midterms", "Finals"].includes(period)
        ) {
            throw new Error("Your academic settings are incomplete.");
        }

        return {
            grade_level: grade,
            semester: semester,
            grading_period: period
        };
    }

    // Retrieve subjects for the selected academic context.
    async function getSubjects() {
        const user = await getCurrentUser();
        const context = getAcademicContext();

        const { data, error } = await supabase
            .from("subjects")
            .select("*")
            .eq("user_id", user.id)
            .eq("grade_level", context.grade_level)
            .eq("semester", context.semester)
            .eq("grading_period", context.grading_period)
            .order("created_at", { ascending: true });

        if (error) throw error;

        return data;
    }

    // Add a subject.
    async function addSubject(subject) {
        const user = await getCurrentUser();
        const context = getAcademicContext();

        const { data, error } = await supabase
            .from("subjects")
            .insert({
                user_id: user.id,
                ...context,
                subject_name: subject.subject_name.trim(),
                teacher: subject.teacher || "",
                units: Number(subject.units) || 1
            })
            .select()
            .single();

        if (error) throw error;

        return data;
    }

    // Update a subject.
    async function updateSubject(subjectId, changes) {
        await getCurrentUser();

        const allowedChanges = {};

        if (changes.subject_name !== undefined) {
            allowedChanges.subject_name = changes.subject_name.trim();
        }

        if (changes.teacher !== undefined) {
            allowedChanges.teacher = changes.teacher;
        }

        if (changes.units !== undefined) {
            allowedChanges.units = Number(changes.units);
        }

        allowedChanges.updated_at = new Date().toISOString();

        const { data, error } = await supabase
            .from("subjects")
            .update(allowedChanges)
            .eq("id", subjectId)
            .select()
            .single();

        if (error) throw error;

        return data;
    }

    // Delete a subject.
    async function deleteSubject(subjectId) {
        await getCurrentUser();

        const { error } = await supabase
            .from("subjects")
            .delete()
            .eq("id", subjectId);

        if (error) throw error;
    }

    // Make database functions available to other Aralytics scripts.
    window.aralyticsDB = {
        getCurrentUser,
        getAcademicContext,
        getSubjects,
        addSubject,
        updateSubject,
        deleteSubject
    };

    console.log("Aralytics database helper loaded!");
})();
