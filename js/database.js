
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

    function normalizeSubjectName(name) {
        return String(name || "").trim().toLowerCase();
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
            throw new Error(
                "Subject units must be greater than zero."
            );
        }

        const existingSubjects = await getSubjects(context);

        const duplicate = existingSubjects.some(item =>
            normalizeSubjectName(item.subject_name) ===
            normalizeSubjectName(name)
        );

        if (duplicate) {
            throw new Error(
                "This subject has already been added."
            );
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
                throw new Error(
                    "Subject name cannot be empty."
                );
            }

            allowedChanges.subject_name = name;
        }

        if (changes.teacher !== undefined) {
            allowedChanges.teacher =
                String(changes.teacher).trim();
        }

        if (changes.units !== undefined) {
            const units = Number(changes.units);

            if (!Number.isFinite(units) || units <= 0) {
                throw new Error(
                    "Subject units must be greater than zero."
                );
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

    /*
       Subject units are shared between Midterms
       and Finals within the same grade and semester.
    */

    async function updateSharedSubjectUnits(subjectId, units) {
        const user = await getCurrentUser();

        const numericUnits = Number(units);

        if (
            !Number.isFinite(numericUnits) ||
            numericUnits <= 0
        ) {
            throw new Error(
                "Subject units must be greater than zero."
            );
        }

        const subject = await getSubjectById(subjectId);

        const { data: allSubjects, error: fetchError } =
            await supabase
                .from("subjects")
                .select("id, subject_name")
                .eq("user_id", user.id)
                .eq("grade_level", subject.grade_level)
                .eq("semester", subject.semester);

        if (fetchError) throw fetchError;

        const matchingIds = allSubjects
            .filter(item =>
                normalizeSubjectName(item.subject_name) ===
                normalizeSubjectName(subject.subject_name)
            )
            .map(item => item.id);

        if (matchingIds.length === 0) {
            throw new Error(
                "No matching subject records were found."
            );
        }

        const { data, error } = await supabase
            .from("subjects")
            .update({
                units: numericUnits,
                updated_at: new Date().toISOString()
            })
            .eq("user_id", user.id)
            .in("id", matchingIds)
            .select();

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

        if (!Array.isArray(components)) {
            throw new Error("Invalid grading components.");
        }

        const rows = components.map((component, index) => {
            const name = String(
                component.component_name || ""
            ).trim();

            const weight = Number(component.weight);

            if (!name) {
                throw new Error(
                    "Every grading component needs a name."
                );
            }

            if (
                !Number.isFinite(weight) ||
                weight < 0 ||
                weight > 100
            ) {
                throw new Error(
                    "Component weights must be between 0 and 100."
                );
            }

            return {
                ...(component.id ? { id: component.id } : {}),
                user_id: user.id,
                subject_id: subjectId,
                component_name: name,
                weight: weight,
                display_order: index,
                updated_at: new Date().toISOString()
            };
        });

        if (rows.length === 0) {
            return [];
        }

        const { data, error } = await supabase
            .from("grading_components")
            .upsert(rows, { onConflict: "id" })
            .select();

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

        if (!Array.isArray(assessments)) {
            throw new Error("Invalid assessment data.");
        }

        const rows = assessments.map((assessment, index) => {
            const earned =
                assessment.points_earned === "" ||
                assessment.points_earned === null ||
                assessment.points_earned === undefined
                    ? null
                    : Number(assessment.points_earned);

            const possible =
                assessment.points_possible === "" ||
                assessment.points_possible === null ||
                assessment.points_possible === undefined
                    ? null
                    : Number(assessment.points_possible);

            if (
                earned !== null &&
                (!Number.isFinite(earned) || earned < 0)
            ) {
                throw new Error(
                    "Points earned must be a valid non-negative number."
                );
            }

            if (
                possible !== null &&
                (!Number.isFinite(possible) || possible <= 0)
            ) {
                throw new Error(
                    "Points possible must be greater than zero."
                );
            }

            if (
                earned !== null &&
                possible !== null &&
                earned > possible
            ) {
                throw new Error(
                    "Points earned cannot exceed points possible."
                );
            }

            return {
                ...(assessment.id ? { id: assessment.id } : {}),
                user_id: user.id,
                component_id: componentId,
                assessment_name: String(
                    assessment.assessment_name || ""
                ).trim(),
                assessment_date:
                    assessment.assessment_date || null,
                points_earned: earned,
                points_possible: possible,
                display_order: index,
                updated_at: new Date().toISOString()
            };
        });

        if (rows.length === 0) {
            return [];
        }

        const { data, error } = await supabase
            .from("assessments")
            .upsert(rows, { onConflict: "id" })
            .select();

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

    /*
       Retrieves multiple subject grades in one request.
       Useful for period GWA and semester GWA.
    */

    async function getSubjectGrades(subjectIds) {
        await getCurrentUser();

        if (!Array.isArray(subjectIds) || subjectIds.length === 0) {
            return [];
        }

        const uniqueIds = [...new Set(subjectIds)];

        const { data, error } = await supabase
            .from("subject_grades")
            .select("*")
            .in("subject_id", uniqueIds);

        if (error) throw error;

        return data;
    }

    async function saveSubjectGrade(subjectId, gradeData) {
        const user = await getCurrentUser();

        const manualGrade =
            gradeData.manual_grade === "" ||
            gradeData.manual_grade === undefined
                ? null
                : gradeData.manual_grade;

        const calculatedGrade =
            gradeData.calculated_grade === "" ||
            gradeData.calculated_grade === undefined
                ? null
                : gradeData.calculated_grade;

        const { data, error } = await supabase
            .from("subject_grades")
            .upsert({
                user_id: user.id,
                subject_id: subjectId,
                manual_grade: manualGrade,
                calculated_grade: calculatedGrade,
                graded_assessments:
                    Number(gradeData.graded_assessments) || 0,
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

    /*
       Find an existing goal before saving.
       This handles the database's partial unique indexes
       for subject goals and GWA goals.
    */

    async function saveGoal(goal) {
        const user = await getCurrentUser();

        const goalType = goal.goal_type;
        const targetGrade = Number(goal.target_grade);
        const gradeLevel = Number(goal.grade_level);
        const semester = Number(goal.semester);
        const gradingPeriod = goal.grading_period;

        if (!["subject", "gwa"].includes(goalType)) {
            throw new Error("Invalid goal type.");
        }

        if (
            !Number.isFinite(targetGrade) ||
            targetGrade < 0 ||
            targetGrade > 100
        ) {
            throw new Error(
                "Target grade must be between 0 and 100."
            );
        }

        if (
            !Number.isInteger(gradeLevel) ||
            gradeLevel < 7 ||
            gradeLevel > 12 ||
            ![1, 2].includes(semester) ||
            !["Midterms", "Finals"].includes(gradingPeriod)
        ) {
            throw new Error("Invalid academic context.");
        }

        if (goalType === "subject" && !goal.subject_id) {
            throw new Error(
                "A subject must be selected for this goal."
            );
        }

        let query = supabase
            .from("academic_goals")
            .select("id")
            .eq("user_id", user.id)
            .eq("goal_type", goalType)
            .eq("grade_level", gradeLevel)
            .eq("semester", semester)
            .eq("grading_period", gradingPeriod);

        if (goalType === "subject") {
            query = query.eq("subject_id", goal.subject_id);
        } else {
            query = query.is("subject_id", null);
        }

        const { data: existingGoal, error: findError } =
            await query.maybeSingle();

        if (findError) throw findError;

        const goalData = {
            user_id: user.id,
            goal_type: goalType,
            subject_id:
                goalType === "subject" ? goal.subject_id : null,
            target_grade: targetGrade,
            grade_level: gradeLevel,
            semester: semester,
            grading_period: gradingPeriod,
            updated_at: new Date().toISOString()
        };

        let result;

        if (existingGoal) {
            result = await supabase
                .from("academic_goals")
                .update(goalData)
                .eq("id", existingGoal.id)
                .select()
                .single();
        } else {
            result = await supabase
                .from("academic_goals")
                .insert(goalData)
                .select()
                .single();
        }

        if (result.error) throw result.error;

        return result.data;
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
       PUBLIC API
    ========================================= */

    window.aralyticsDB = {
        getCurrentUser,
        getAcademicContext,

        // Subjects
        getSubjects,
        getSubjectById,
        addSubject,
        updateSubject,
        updateSharedSubjectUnits,
        deleteSubject,

        // Grading components
        getComponents,
        saveComponents,
        deleteComponent,

        // Assessments
        getAssessments,
        saveAssessments,
        deleteAssessment,

        // Subject grades
        getSubjectGrade,
        getSubjectGrades,
        saveSubjectGrade,

        // Academic goals
        getGoals,
        saveGoal,
        deleteGoal
    };

    console.log("Aralytics database helper loaded successfully!");

})();
