
function calculateGrade() {

    let totalWeight = 0;
    let finalGrade = 0;

    for (let i = 1; i <= 3; i++) {

        let score = document.getElementById("score" + i).value;
        let weight = document.getElementById("weight" + i).value;

        if (score === "" || weight === "") {
            alert("Please complete all score and weight fields.");
            return;
        }

        score = Number(score);
        weight = Number(weight);

        if (score < 0 || score > 100 || weight < 0 || weight > 100) {
            alert("Scores and weights must be between 0 and 100.");
            return;
        }

        totalWeight += weight;
        finalGrade += score * (weight / 100);
    }

    if (totalWeight !== 100) {
        alert("Your assessment weights must add up to exactly 100%.");
        return;
    }

    document.getElementById("result").innerHTML = `
        <h3>Your Calculated Grade</h3>
        <strong>${finalGrade.toFixed(2)}</strong>
        <p>Based on your assessment scores and weights.</p>
    `;
}
