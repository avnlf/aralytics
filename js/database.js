
/* =========================================
   ARALYTICS DATABASE HELPER
   Supabase academic data operations
========================================= */

(function () {
    const supabase = window.supabaseClient;

    if (!supabase) {
        console.error("Supabase connection not found.");
        return;
    }

    /* =========================================
       AUTHENTICATION AND ACADEMIC CONTEXT
    ========================================= */

    async function getCurrentUser() {
        const { data, error } = await supabase.auth.getUser();

        if (error) throw error;

        if (!data.user) {
            throw new Error("You must be logged in.");
        }

        return data.user;
    }

    function getAcademicContext() {
        const grade = Number(
            localStorage.getItem("aralyticsCurrentGrade")
        );

        const semester = Number(
            localStorage.getItem("aralyticsCurrentSemester")
        );

        const period = localStorage.getItem(
            "aralyticsCurrentPeriod"
        );

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

    /* =========================================
       SUBJECTS
    ========================================= */

    async function getSubjects(context = getAcademicContext()) {
        const user = await getCurrentUser();

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

    async function getSubjectById(subjectId) {
        await getCurrentUser();

        const { data, error } = await supabase
            .from("subjects")
            .select("*")
            .eq("id", subjectId)
            .single();

        if (error) throw error;

        return data;
    }

    async function addSubject(subject) {
        const user = await getCurrentUser();
        const context = getAcademicContext();

        const name = String(subject.subject_name || "").trim();
        const teacher = String(subject.teacher || "").trim();
        const units = Number(subject.units);

        if (!name) {
            throw new Error("Subject name is required.");
        }

        if (!Number.isFinite(units) || units <= 0) {
            throw new Error("Subject units must be greater than zero.");
        }

        const { data, error } = await supabase
            .from("subjects")
            .insert({
                user_id: user.id,
                ...context,
                subject_name: name,
                teacher: teacher,
                units: units
            })
            .select()
            .single();

        if (error) throw error;

        return data;
    }

    async function updateSubject(subjectId, changes) {
        await getCurrentUser();

        const allowedChanges = {};

        if (changes.subject_name !== undefined) {
            const name = String(changes.subject_name).trim();

            if (!name) {
                throw new Error("Subject name cannot be empty.");
            }

            allowedChanges.subject_name = name;
        }

        if (changes.teacher !== undefined) {
            allowedChanges.teacher = String(changes.teacher).trim();
        }

        if (changes.units !== undefined) {
            const units = Number(changes.units);

            if (!Number.isFinite(units) || units <= 0) {
                throw new Error("Subject units must be greater than zero.");
            }

            allowedChanges.units = units;
        }

        if (Object.keys(allowedChanges).length === 0) {
            return null;
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

    async function deleteSubject(subjectId) {
        await getCurrentUser();

        const { error } = await supabase
            .from("subjects")
            .delete()
            .eq("id", subjectId);

        if (error) throw error;
    }

    /* =========================================
       GRADING COMPONENTS
    ========================================= */

    async function getComponents(subjectId) {
        await getCurrentUser();

        const { data, error } = await supabase
            .from("grading_components")
            .select("*")
            .eq("subject_id", subjectId)
            .order("display_order", { ascending: true });

        if (error) throw error;

        return data;
    }

    async function saveComponents(subjectId, components) {
        const user = await getCurrentUser();

        // Replace the existing component list.
        const { error: deleteError } = await supabase
            .from("grading_components")
            .delete()
            .eq("subject_id", subjectId);

        if (deleteError) throw deleteError;

        if (!components.length) {
            return [];
        }

        const rows = components.map((component, index) => ({
            user_id: user.id,
            subject_id: subjectId,
            component_name: String(component.component_name || "").trim(),
            weight: Number(component.weight),
            display_order: index
        }));

        const { data, error } = await supabase
            .from("grading_components")
            .insert(rows)
            .select();

        if (error) throw error;

        return data;
    }

    /* =========================================
       ASSESSMENTS
    ========================================= */

    async function getAssessments(componentId) {
        await getCurrentUser();

        const { data, error } = await supabase
            .from("assessments")
            .select("*")
            .eq("component_id", componentId)
            .order("display_order", { ascending: true });

        if (error) throw error;

        return data;
    }

    async function saveAssessments(componentId, assessments) {
        const user = await getCurrentUser();

        const { error: deleteError } = await supabase
            .from("assessments")
            .delete()
            .eq("component_id", componentId);

        if (deleteError) throw deleteError;

        if (!assessments.length) {
            return [];
        }

        const rows = assessments.map((assessment, index) => ({
            user_id: user.id,
            component_id: componentId,
            assessment_name: String(assessment.assessment_name || ""),
            assessment_date: assessment.assessment_date || null,
            points_earned:
                assessment.points_earned === "" ||
                assessment.points_earned === null
                    ? null
                    : Number(assessment.points_earned),
            points_possible:
                assessment.points_possible === "" ||
                assessment.points_possible === null
                    ? null
                    : Number(assessment.points_possible),
            display_order: index
        }));

        const { data, error } = await supabase
            .from("assessments")
            .insert(rows)
            .select();

        if (error) throw error;

        return data;
    }

    /* =========================================
       SUBJECT GRADES
    ========================================= */

    async function getSubjectGrade(subjectId) {
        await getCurrentUser();

        const { data, error } = await supabase
            .from("subject_grades")
            .select("*")
            .eq("subject_id", subjectId)
            .maybeSingle();

        if (error) throw error;

        return data;
    }

    async function saveSubjectGrade(subjectId, gradeData) {
        const user = await getCurrentUser();

        const { data, error } = await supabase
            .from("subject_grades")
            .upsert({
                user_id: user.id,
                subject_id: subjectId,
                manual_grade: gradeData.manual_grade ?? null,
                calculated_grade: gradeData.calculated_grade ?? null,
                graded_assessments: gradeData.graded_assessments || 0,
                weight_valid: Boolean(gradeData.weight_valid),
                updated_at: new Date().toISOString()
            }, {
                onConflict: "user_id,subject_id"
            })
            .select()
            .single();

        if (error) throw error;

        return data;
    }

    /* =========================================
       ACADEMIC GOALS
    ========================================= */

    async function getGoals(context = getAcademicContext()) {
        const user = await getCurrentUser();

        const { data, error } = await supabase
            .from("academic_goals")
            .select("*")
            .eq("user_id", user.id)
            .eq("grade_level", context.grade_level)
            .eq("semester", context.semester)
            .eq("grading_period", context.grading_period);

        if (error) throw error;

        return data;
    }

    async function saveGoal(goal) {
        const user = await getCurrentUser();

        const { data, error } = await supabase
            .from("academic_goals")
            .upsert({
                user_id: user.id,
                goal_type: goal.goal_type,
                subject_id: goal.subject_id ?? null,
                target_grade: Number(goal.target_grade),
                grade_level: goal.grade_level,
                semester: goal.semester,
                grading_period: goal.grading_period,
                updated_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) throw error;

        return data;
    }

    async function deleteGoal(goalId) {
        await getCurrentUser();

        const { error } = await supabase
            .from("academic_goals")
            .delete()
            .eq("id", goalId);

        if (error) throw error;
    }

    /* =========================================
       PUBLIC DATABASE API
    ========================================= */

    window.aralyticsDB = {
        getCurrentUser,
        getAcademicContext,

        getSubjects,
        getSubjectById,
        addSubject,
        updateSubject,
        deleteSubject,

        getComponents,
        saveComponents,

        getAssessments,
        saveAssessments,

        getSubjectGrade,
        saveSubjectGrade,

        getGoals,
        saveGoal,
        deleteGoal
    };

    console.log("Aralytics database helper loaded!");
})();
