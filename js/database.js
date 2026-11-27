
// Aralytics Database Helper
// Handles Supabase operations for subjects, gradebooks, assessments, and grades.

(function () {
    const supabase = window.supabaseClient;

    if (!supabase) {
        console.error("Supabase connection not found.");
        return;
    }

    // AUTHENTICATION

    async function getCurrentUser() {
        const { data, error } = await supabase.auth.getUser();

        if (error) throw error;

        if (!data.user) {
            throw new Error("You must be logged in.");
        }

        return data.user;
    }


    // ACADEMIC CONTEXT

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
            !Number.isInteger(grade) ||
            grade < 7 ||
            grade > 12 ||
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


    // SUBJECTS

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

        return data || [];
    }


    async function getSubjectsForSemester(grade, semester) {
        const user = await getCurrentUser();

        const { data, error } = await supabase
            .from("subjects")
            .select("*")
            .eq("user_id", user.id)
            .eq("grade_level", grade)
            .eq("semester", semester)
            .order("created_at", { ascending: true });

        if (error) throw error;

        return data || [];
    }


    async function getSubjectById(subjectId) {
        await getCurrentUser();

        const { data, error } = await supabase
            .from("subjects")
            .select("*")
            .eq("id", subjectId)
            .maybeSingle();

        if (error) throw error;

        return data;
    }


    async function addSubject(subject, context = getAcademicContext()) {
        const user = await getCurrentUser();

        const name = String(subject.subject_name || "").trim();

        if (!name) {
            throw new Error("Subject name is required.");
        }

        const units = Number(subject.units);

        if (!Number.isFinite(units) || units <= 0) {
            throw new Error("Subject units must be greater than zero.");
        }

        // Prevent duplicate subjects in the same grading period.
        const existingSubjects = await getSubjects(context);

        const duplicate = existingSubjects.some(item =>
            item.subject_name.trim().toLowerCase() === name.toLowerCase()
        );

        if (duplicate) {
            throw new Error("This subject already exists.");
        }

        const { data, error } = await supabase
            .from("subjects")
            .insert({
                user_id: user.id,
                ...context,
                subject_name: name,
                teacher: subject.teacher || "",
                units: units
            })
            .select()
            .single();

        if (error) throw error;

        return data;
    }


    async function updateSubject(subjectId, changes) {
        await getCurrentUser();

        const existing = await getSubjectById(subjectId);

        if (!existing) {
            throw new Error("Subject not found.");
        }

        const allowedChanges = {};

        if (changes.subject_name !== undefined) {
            const name = String(changes.subject_name).trim();

            if (!name) {
                throw new Error("Subject name cannot be empty.");
            }

            allowedChanges.subject_name = name;
        }

        if (changes.teacher !== undefined) {
            allowedChanges.teacher = changes.teacher;
        }

        if (changes.units !== undefined) {
            const units = Number(changes.units);

            if (!Number.isFinite(units) || units <= 0) {
                throw new Error("Subject units must be greater than zero.");
            }

            allowedChanges.units = units;
        }

        allowedChanges.updated_at = new Date().toISOString();

        const { data, error } = await supabase
            .from("subjects")
            .update(allowedChanges)
            .eq("id", subjectId)
            .select()
            .single();

        if (error) throw error;

        // Keep units consistent between Midterms and Finals
        // for the same subject, grade level, and semester.
        if (changes.units !== undefined) {
            const otherPeriod =
                existing.grading_period === "Midterms"
                    ? "Finals"
                    : "Midterms";

            const { error: syncError } = await supabase
                .from("subjects")
                .update({
                    units: Number(changes.units),
                    updated_at: new Date().toISOString()
                })
                .eq("grade_level", existing.grade_level)
                .eq("semester", existing.semester)
                .eq("grading_period", otherPeriod)
                .ilike("subject_name", existing.subject_name);

            if (syncError) throw syncError;
        }

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


    // GRADING COMPONENTS

    async function getComponents(subjectId) {
        await getCurrentUser();

        const { data, error } = await supabase
            .from("grading_components")
            .select("*")
            .eq("subject_id", subjectId)
            .order("display_order", { ascending: true });

        if (error) throw error;

        return data || [];
    }


    async function addComponent(subjectId, component) {
        const user = await getCurrentUser();

        const { data, error } = await supabase
            .from("grading_components")
            .insert({
                user_id: user.id,
                subject_id: subjectId,
                component_name: component.component_name,
                weight: Number(component.weight) || 0,
                display_order: Number(component.display_order) || 0
            })
            .select()
            .single();

        if (error) throw error;

        return data;
    }


    async function updateComponent(componentId, changes) {
        await getCurrentUser();

        const allowedChanges = {};

        if (changes.component_name !== undefined) {
            allowedChanges.component_name = changes.component_name;
        }

        if (changes.weight !== undefined) {
            allowedChanges.weight = Number(changes.weight);
        }

        if (changes.display_order !== undefined) {
            allowedChanges.display_order = Number(changes.display_order);
        }

        allowedChanges.updated_at = new Date().toISOString();

        const { data, error } = await supabase
            .from("grading_components")
            .update(allowedChanges)
            .eq("id", componentId)
            .select()
            .single();

        if (error) throw error;

        return data;
    }


    async function deleteComponent(componentId) {
        await getCurrentUser();

        const { error } = await supabase
            .from("grading_components")
            .delete()
            .eq("id", componentId);

        if (error) throw error;
    }


    // ASSESSMENTS

    async function getAssessments(componentId) {
        await getCurrentUser();

        const { data, error } = await supabase
            .from("assessments")
            .select("*")
            .eq("component_id", componentId)
            .order("display_order", { ascending: true });

        if (error) throw error;

        return data || [];
    }


    async function addAssessment(componentId, assessment) {
        const user = await getCurrentUser();

        const { data, error } = await supabase
            .from("assessments")
            .insert({
                user_id: user.id,
                component_id: componentId,
                assessment_name: assessment.assessment_name || "",
                assessment_date: assessment.assessment_date || null,
                points_earned: assessment.points_earned ?? null,
                points_possible: assessment.points_possible ?? null,
                display_order: Number(assessment.display_order) || 0
            })
            .select()
            .single();

        if (error) throw error;

        return data;
    }


    async function updateAssessment(assessmentId, changes) {
        await getCurrentUser();

        const allowedChanges = {};

        if (changes.assessment_name !== undefined) {
            allowedChanges.assessment_name = changes.assessment_name;
        }

        if (changes.assessment_date !== undefined) {
            allowedChanges.assessment_date =
                changes.assessment_date || null;
        }

        if (changes.points_earned !== undefined) {
            allowedChanges.points_earned =
                changes.points_earned === "" ? null : changes.points_earned;
        }

        if (changes.points_possible !== undefined) {
            allowedChanges.points_possible =
                changes.points_possible === "" ? null : changes.points_possible;
        }

        if (changes.display_order !== undefined) {
            allowedChanges.display_order = Number(changes.display_order);
        }

        allowedChanges.updated_at = new Date().toISOString();

        const { data, error } = await supabase
            .from("assessments")
            .update(allowedChanges)
            .eq("id", assessmentId)
            .select()
            .single();

        if (error) throw error;

        return data;
    }


    async function deleteAssessment(assessmentId) {
        await getCurrentUser();

        const { error } = await supabase
            .from("assessments")
            .delete()
            .eq("id", assessmentId);

        if (error) throw error;
    }


    // SUBJECT GRADES

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


    async function getSubjectGrades(subjectIds) {
        await getCurrentUser();

        if (!subjectIds || subjectIds.length === 0) {
            return [];
        }

        const { data, error } = await supabase
            .from("subject_grades")
            .select("*")
            .in("subject_id", subjectIds);

        if (error) throw error;

        return data || [];
    }


    async function saveSubjectGrade(subjectId, changes) {
        const user = await getCurrentUser();

        // Preserve existing values when only one grade type changes.
        const existing = await getSubjectGrade(subjectId);

        const record = {
            user_id: user.id,
            subject_id: subjectId,
            manual_grade: existing?.manual_grade ?? null,
            calculated_grade: existing?.calculated_grade ?? null,
            graded_assessments: existing?.graded_assessments ?? 0,
            weight_valid: existing?.weight_valid ?? false,
            updated_at: new Date().toISOString()
        };

        if (changes.manual_grade !== undefined) {
            record.manual_grade = changes.manual_grade;
        }

        if (changes.calculated_grade !== undefined) {
            record.calculated_grade = changes.calculated_grade;
        }

        if (changes.graded_assessments !== undefined) {
            record.graded_assessments = changes.graded_assessments;
        }

        if (changes.weight_valid !== undefined) {
            record.weight_valid = changes.weight_valid;
        }

        const { data, error } = await supabase
            .from("subject_grades")
            .upsert(record, {
                onConflict: "user_id,subject_id"
            })
            .select()
            .single();

        if (error) throw error;

        return data;
    }


    // COMPLETE GRADEBOOK DATA

    async function getGradebookData(subjectId) {
        const subject = await getSubjectById(subjectId);

        if (!subject) {
            throw new Error("Subject not found.");
        }

        const components = await getComponents(subjectId);

        const componentsWithAssessments = await Promise.all(
            components.map(async component => {
                const assessments = await getAssessments(component.id);

                return {
                    ...component,
                    assessments: assessments
                };
            })
        );

        const grade = await getSubjectGrade(subjectId);

        return {
            subject,
            components: componentsWithAssessments,
            grade
        };
    }


    // PUBLIC DATABASE FUNCTIONS

    window.aralyticsDB = {
        getCurrentUser,
        getAcademicContext,

        getSubjects,
        getSubjectsForSemester,
        getSubjectById,
        addSubject,
        updateSubject,
        deleteSubject,

        getComponents,
        addComponent,
        updateComponent,
        deleteComponent,

        getAssessments,
        addAssessment,
        updateAssessment,
        deleteAssessment,

        getSubjectGrade,
        getSubjectGrades,
        saveSubjectGrade,

        getGradebookData
    };

    console.log("Aralytics database helper loaded!");
})();
