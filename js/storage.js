
// ARALYTICS DATA STORAGE

function getSubjects() {
    return JSON.parse(localStorage.getItem("aralyticsSubjects")) || [];
}

function saveSubjects(subjects) {
    localStorage.setItem("aralyticsSubjects", JSON.stringify(subjects));
}

function getGrades() {
    return JSON.parse(localStorage.getItem("aralyticsGrades")) || {};
}

function saveGrades(grades) {
    localStorage.setItem("aralyticsGrades", JSON.stringify(grades));
}