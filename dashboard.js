
// ==========================================
// ARALYTICS DASHBOARD CHARTS - SUPABASE
// ==========================================

async function initializeDashboardCharts() {
    const db = window.aralyticsDB;

    if (!db) {
        console.error("Aralytics database is not loaded.");
        return;
    }

    try {
        const context = db.getAcademicContext();
        const chartGrade = Number(context.grade_level);

        // ==========================================
        // GET SUBJECTS FOR ALL SEMESTERS AND PERIODS
        // ==========================================

        const contexts = [];

        for (const semester of [1, 2]) {
            for (const period of ["Midterms", "Finals"]) {
                contexts.push({
                    grade_level: chartGrade,
                    semester: semester,
                    grading_period: period
                });
            }
        }

        const subjectGroups = await Promise.all(
            contexts.map(item => db.getSubjects(item))
        );

        const allSubjects = subjectGroups.flat();

        // ==========================================
        // GET SAVED GRADES
        // ==========================================

        const subjectIds = allSubjects.map(subject => subject.id);
        const savedGrades = await db.getSubjectGrades(subjectIds);

        const gradeMap = new Map();

        savedGrades.forEach(record => {
            gradeMap.set(record.subject_id, record);
        });

        // ==========================================
        // GET EFFECTIVE SUBJECT GRADE
        // ==========================================

        function getSubjectGrade(subject) {
            const record = gradeMap.get(subject.id);

            if (!record) return null;

            const savedGrade =
                record.manual_grade !== null
                    ? record.manual_grade
                    : record.calculated_grade;

            if (savedGrade === null || savedGrade === undefined) {
                return null;
            }

            const value = Number(savedGrade);

            return Number.isFinite(value) && value >= 0 && value <= 100
                ? value
                : null;
        }

        // ==========================================
        // CALCULATE PERIOD GWA
        // ==========================================

        function getPeriodGWA(semester, period) {
            const subjects = allSubjects.filter(subject =>
                Number(subject.semester) === Number(semester) &&
                subject.grading_period === period
            );

            let weightedTotal = 0;
            let totalUnits = 0;

            subjects.forEach(subject => {
                const grade = getSubjectGrade(subject);
                const units = Number(subject.units);

                if (
                    grade === null ||
                    !Number.isFinite(units) ||
                    units <= 0
                ) return;

                weightedTotal += grade * units;
                totalUnits += units;
            });

            return totalUnits > 0
                ? weightedTotal / totalUnits
                : null;
        }

        // ==========================================
        // CALCULATE SEMESTER GWA
        // ==========================================

        function getSemesterGWA(semester) {
            const midtermSubjects = allSubjects.filter(subject =>
                Number(subject.semester) === Number(semester) &&
                subject.grading_period === "Midterms"
            );

            const finalsSubjects = allSubjects.filter(subject =>
                Number(subject.semester) === Number(semester) &&
                subject.grading_period === "Finals"
            );

            const midtermWeight =
                chartGrade <= 10 ? 1 / 3 : 0.5;

            const finalsWeight =
                chartGrade <= 10 ? 2 / 3 : 0.5;

            let weightedTotal = 0;
            let totalUnits = 0;

            midtermSubjects.forEach(midtermSubject => {
                const matchingFinalsSubject = finalsSubjects.find(subject =>
                    subject.subject_name.trim().toLowerCase() ===
                    midtermSubject.subject_name.trim().toLowerCase()
                );

                if (!matchingFinalsSubject) return;

                const midtermGrade = getSubjectGrade(midtermSubject);
                const finalsGrade = getSubjectGrade(matchingFinalsSubject);

                if (
                    midtermGrade === null ||
                    finalsGrade === null
                ) return;

                const units = Number(midtermSubject.units);

                if (!Number.isFinite(units) || units <= 0) return;

                const semesterGrade =
                    midtermGrade * midtermWeight +
                    finalsGrade * finalsWeight;

                weightedTotal += semesterGrade * units;
                totalUnits += units;
            });

            return totalUnits > 0
                ? weightedTotal / totalUnits
                : null;
        }

        // ==========================================
        // BAR GRAPH: ACADEMIC PERFORMANCE
        // ==========================================

        const performanceCanvas =
            document.getElementById("performanceChart");

        if (performanceCanvas) {
            const currentSubjects = allSubjects.filter(subject =>
                Number(subject.grade_level) === chartGrade &&
                Number(subject.semester) === Number(context.semester) &&
                subject.grading_period === context.grading_period
            );

            const chartLabels = [];
            const chartGrades = [];

            currentSubjects.forEach(subject => {
                const grade = getSubjectGrade(subject);

                if (grade !== null) {
                    chartLabels.push(subject.subject_name);
                    chartGrades.push(Number(grade.toFixed(2)));
                }
            });

            new Chart(performanceCanvas, {
                type: "bar",
                data: {
                    labels: chartLabels,
                    datasets: [{
                        label: "Subject Grades",
                        data: chartGrades,
                        backgroundColor: [
                            "#78977B",
                            "#A8C9C0",
                            "#559B91",
                            "#D9C49A",
                            "#D9A45B",
                            "#C87575"
                        ],
                        borderRadius: 8
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 100,
                            ticks: { stepSize: 10 }
                        }
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: context =>
                                    "Grade: " +
                                    context.parsed.y.toFixed(2)
                            }
                        }
                    }
                }
            });
        }

        // ==========================================
        // LINE GRAPH: ACADEMIC PROGRESS
        // ==========================================

        const progressCanvas =
            document.getElementById("progressChart");

        if (progressCanvas) {
            const progressLabels = [
                "S1 Midterms",
                "S1 Finals",
                "S1 Semester",
                "S2 Midterms",
                "S2 Finals",
                "S2 Semester"
            ];

            const progressGrades = [
                getPeriodGWA(1, "Midterms"),
                getPeriodGWA(1, "Finals"),
                getSemesterGWA(1),
                getPeriodGWA(2, "Midterms"),
                getPeriodGWA(2, "Finals"),
                getSemesterGWA(2)
            ];

            new Chart(progressCanvas, {
                type: "line",
                data: {
                    labels: progressLabels,
                    datasets: [{
                        label: "Academic Average",
                        data: progressGrades,
                        borderColor: "#78977B",
                        backgroundColor: "rgba(120, 151, 123, 0.15)",
                        fill: true,
                        tension: 0.3,
                        pointRadius: 5,
                        pointHoverRadius: 8,
                        spanGaps: false
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: false,
                            min: 0,
                            max: 100,
                            ticks: { stepSize: 10 }
                        }
                    },
                    plugins: {
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const value = context.parsed.y;

                                    return value !== null
                                        ? "GWA: " + value.toFixed(2)
                                        : "No grades recorded";
                                }
                            }
                        }
                    }
                }
            });
        }

    } catch (error) {
        console.error("Dashboard chart loading error:", error);
    }
}

// ==========================================
// START DASHBOARD CHARTS
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
    initializeDashboardCharts();
});
