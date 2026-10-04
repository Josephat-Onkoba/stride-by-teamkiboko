document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('prediction-form');
    const predictBtn = document.getElementById('predict-btn');
    const resultContainer = document.getElementById('result-container');
    const resultTime = document.getElementById('result-time');
    const resultMessage = document.getElementById('result-message');
    const evidenceTag = document.getElementById('evidence-tag');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const halfSplit = document.getElementById('half_split').value;
        const age = document.getElementById('age').value;
        const category = document.getElementById('category').value;
        
        // UI Loading State
        const originalBtnText = predictBtn.textContent;
        predictBtn.textContent = 'Calculating...';
        predictBtn.disabled = true;

        try {
            const response = await fetch('/predict', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    half_split: halfSplit,
                    age: age,
                    category: category
                })
            });

            const data = await response.json();

            if (response.ok) {
                // Format the minutes into HH:MM
                const totalMinutes = Math.round(data.predicted_finish_time);
                const hours = Math.floor(totalMinutes / 60);
                const minutes = totalMinutes % 60;
                
                resultTime.textContent = `${hours}h ${minutes < 10 ? '0' + minutes : minutes}m`;
                evidenceTag.textContent = `${data.evidence_tag} Validated Pilot`;
                resultMessage.textContent = 'Projected Finish Time';
                
                resultContainer.classList.add('visible');
            } else {
                alert(data.error || 'An error occurred');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Failed to connect to the server.');
        } finally {
            predictBtn.textContent = originalBtnText;
            predictBtn.disabled = false;
        }
    });
});
