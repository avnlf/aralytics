
function calculateGoal() {

    let current = Number(document.getElementById("currentGrade").value);
    let target = Number(document.getElementById("targetGrade").value);
    let completed = Number(document.getElementById("completedWeight").value);
    let remaining = Number(document.getElementById("remainingWeight").value);

    let result = document.getElementById("goalResult");

    if (
        document.getElementById("currentGrade").value === "" ||
        document.getElementById("targetGrade").value === "" ||
        document.getElementById("completedWeight").value === "" ||
        document.getElementById("remainingWeight").value === ""
    ) {
        alert("Please complete all fields.");
        return;
    }

    if (
        current < 0 || current > 100 ||
        target < 0 || target > 100 ||
        completed < 0 || remaining < 0 ||
        completed > 100 || remaining > 100
    ) {
        alert("Please enter valid values between 0 and 100.");
        return;
    }

    if (completed + remaining !== 100) {
        alert("Completed and remaining percentages must add up to 100%.");
        return;
    }

    if (remaining === 0) {
        result.innerHTML = target <= current
            ? "<h3>Your target has already been reached!</h3>"
            : "<h3>No assessments remain to reach your target.</h3>";
        return;
    }

    let required = (target - (current * completed / 100)) / (remaining / 100);

    if (required <= 0) {
        result.innerHTML = `
            <h3>You've already reached your target!</h3>
            <strong>0.00</strong>
            <p>Your current standing is enough to meet your goal.</p>
        `;
    } else if (required > 100) {
        result.innerHTML = `
            <h3>Your target may no longer be attainable.</h3>
            <strong>${required.toFixed(2)}%</strong>
            <p>The required average exceeds the maximum possible score.</p>
        `;
    } else {
        result.innerHTML = `
            <h3>Average score needed on remaining assessments</h3>
            <strong>${required.toFixed(2)}%</strong>
            <p>Keep working toward your academic goal!</p>
        `;
    }
}
