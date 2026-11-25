
// ==========================================
// ARALYTICS DASHBOARD CHARTS
// ==========================================


// ==========================================
// FUNCTION: GET SUBJECT GRADE
// ==========================================

function getChartSubjectGrade(grade, semester, period, index) {

    // CHECK MANUAL GRADE FIRST

    const manualKey =
        "aralyticsManualGrade_G" + grade +
        "_S" + semester +
        "_" + period +
        "_Subject" + index;

    const manualGrade = localStorage.getItem(manualKey);

    if (manualGrade !== null) {
        const value = Number(manualGrade);

        return Number.isFinite(value) && value >= 0 && value <= 100
            ? value
            : null;
    }

    // OTHERWISE, CALCULATE FROM ASSESSMENTS

    const componentKey =
        "aralyticsComponents_G" + grade +
        "_S" + semester +
        "_" + period +
        "_Subject" + index;

    const assessmentKey =
        "aralyticsAssessments_G" + grade +
        "_S" + semester +
        "_" + period +
        "_Subject" + index;

    const savedComponents = localStorage.getItem(componentKey);
    const savedAssessments = localStorage.getItem(assessmentKey);

    if (!savedComponents || !savedAssessments) return null;

    try {

        const components = JSON.parse(savedComponents);
        const assessments = JSON.parse(savedAssessments);

        let weightedTotal = 0;
        let gradedWeight = 0;

        components.forEach((component, componentIndex) => {

            const rows = assessments[componentIndex] || [];

            let earnedTotal = 0;
            let possibleTotal = 0;

            rows.forEach(assessment => {

                const earned = Number(assessment.earned);
                const possible = Number(assessment.possible);

                if (
                    assessment.earned !== "" &&
                    assessment.possible !== "" &&
                    Number.isFinite(earned) &&
                    Number.isFinite(possible) &&
                    possible > 0 &&
                    earned >= 0 &&
                    earned <= possible
                ) {
                    earnedTotal += earned;
                    possibleTotal += possible;
                }

            });

            const weight = Number(component.weight);

            if (
                possibleTotal > 0 &&
                Number.isFinite(weight) &&
                weight > 0
            ) {

                const average =
                    (earnedTotal / possibleTotal) * 100;

                weightedTotal += average * weight;
                gradedWeight += weight;

            }

        });

        return gradedWeight > 0
            ? weightedTotal / gradedWeight
            : null;

    } catch (error) {

        console.error("Error calculating subject grade:", error);
        return null;

    }

}


// ==========================================
// FUNCTION: GET SUBJECT UNITS
// ==========================================

function getChartSubjectUnits(grade, semester, subject) {

    const unitsKey =
        "aralyticsSubjectUnits_G" + grade +
        "_S" + semester +
        "_" + encodeURIComponent(
            subject.name.trim().toLowerCase()
        );

    const savedUnits = localStorage.getItem(unitsKey);

    const units = Number(
        savedUnits !== null ? savedUnits : subject.units
    );

    return Number.isFinite(units) && units > 0
        ? units
        : null;

}


// ==========================================
// FUNCTION: CALCULATE PERIOD GWA
// ==========================================

function getChartPeriodGWA(grade, semester, period) {

    const storageKey =
        "aralyticsSubjects_G" + grade +
        "_S" + semester +
        "_" + period;

    const subjects = JSON.parse(
        localStorage.getItem(storageKey) || "[]"
    );

    let weightedTotal = 0;
    let totalUnits = 0;

    subjects.forEach((subject, index) => {

        const subjectGrade = getChartSubjectGrade(
            grade,
            semester,
            period,
            index
        );

        if (subjectGrade === null) return;

        const units = getChartSubjectUnits(
            grade,
            semester,
            subject
        );

        if (units === null) return;

        weightedTotal += subjectGrade * units;
        totalUnits += units;

    });

    return totalUnits > 0
        ? weightedTotal / totalUnits
        : null;

}


// ==========================================
// FUNCTION: CALCULATE SEMESTER GWA
// ==========================================

function getChartSemesterGWA(grade, semester) {

    const midtermKey =
        "aralyticsSubjects_G" + grade +
        "_S" + semester + "_Midterms";

    const finalsKey =
        "aralyticsSubjects_G" + grade +
        "_S" + semester + "_Finals";

    const midtermSubjects = JSON.parse(
        localStorage.getItem(midtermKey) || "[]"
    );

    const finalsSubjects = JSON.parse(
        localStorage.getItem(finalsKey) || "[]"
    );

    // SET SEMESTER WEIGHTS

    const midtermWeight =
        Number(grade) >= 7 && Number(grade) <= 10
            ? 1 / 3
            : 0.5;

    const finalsWeight =
        Number(grade) >= 7 && Number(grade) <= 10
            ? 2 / 3
            : 0.5;

    let weightedTotal = 0;
    let totalUnits = 0;

    // MATCH SUBJECTS BY NAME

    midtermSubjects.forEach((midtermSubject, midtermIndex) => {

        const matchingFinalsIndex = finalsSubjects.findIndex(
            subject =>
                subject.name.trim().toLowerCase() ===
                midtermSubject.name.trim().toLowerCase()
        );

        // SUBJECT MUST EXIST IN BOTH PERIODS

        if (matchingFinalsIndex === -1) return;

        const midtermGrade = getChartSubjectGrade(
            grade,
            semester,
            "Midterms",
            midtermIndex
        );

        const finalsGrade = getChartSubjectGrade(
            grade,
            semester,
            "Finals",
            matchingFinalsIndex
        );

        // BOTH PERIODS MUST HAVE GRADES

        if (
            midtermGrade === null ||
            finalsGrade === null
        ) {
            return;
        }

        const semesterGrade =
            midtermGrade * midtermWeight +
            finalsGrade * finalsWeight;

        const units = getChartSubjectUnits(
            grade,
            semester,
            midtermSubject
        );

        if (units === null) return;

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

const chartGrade = localStorage.getItem("aralyticsCurrentGrade");
const chartSemester = localStorage.getItem("aralyticsCurrentSemester");
const chartPeriod = localStorage.getItem("aralyticsCurrentPeriod");

const performanceCanvas = document.getElementById("performanceChart");

if (performanceCanvas) {

    const chartLabels = [];
    const chartGrades = [];

    if (chartGrade && chartSemester && chartPeriod) {

        const storageKey =
            "aralyticsSubjects_G" + chartGrade +
            "_S" + chartSemester +
            "_" + chartPeriod;

        const subjects = JSON.parse(
            localStorage.getItem(storageKey) || "[]"
        );

        subjects.forEach((subject, index) => {

            const subjectGrade = getChartSubjectGrade(
                chartGrade,
                chartSemester,
                chartPeriod,
                index
            );

            if (subjectGrade !== null) {
                chartLabels.push(subject.name);
                chartGrades.push(Number(subjectGrade.toFixed(2)));
            }

        });

    }

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

                    ticks: {
                        stepSize: 10
                    }

                }

            },

            plugins: {

                legend: {
                    display: false
                },

                tooltip: {

                    callbacks: {

                        label: function(context) {
                            return "Grade: " +
                                context.parsed.y.toFixed(2);
                        }

                    }

                }

            }

        }

    });

}


// ==========================================
// LINE GRAPH: ACADEMIC PROGRESS
// ==========================================

const progressCanvas = document.getElementById("progressChart");

if (progressCanvas) {

    const progressLabels = [
        "S1 Midterms",
        "S1 Finals",
        "S1 Semester",
        "S2 Midterms",
        "S2 Finals",
        "S2 Semester"
    ];

    const progressGrades = [];

    if (chartGrade) {

        // SEMESTER 1

        progressGrades.push(
            getChartPeriodGWA(chartGrade, 1, "Midterms")
        );

        progressGrades.push(
            getChartPeriodGWA(chartGrade, 1, "Finals")
        );

        progressGrades.push(
            getChartSemesterGWA(chartGrade, 1)
        );

        // SEMESTER 2

        progressGrades.push(
            getChartPeriodGWA(chartGrade, 2, "Midterms")
        );

        progressGrades.push(
            getChartPeriodGWA(chartGrade, 2, "Finals")
        );

        progressGrades.push(
            getChartSemesterGWA(chartGrade, 2)
        );

    } else {

        progressGrades.push(null, null, null, null, null, null);

    }

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

                    ticks: {
                        stepSize: 10
                    }

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
