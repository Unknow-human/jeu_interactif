// public/js/profile.js
fetch('/getUserInfo')
  .then(response => response.json())
  .then(data => {
    document.getElementById('usernameDisplay').innerText = data.username;
    document.getElementById('scoreDisplay').innerText = data.score;
    // Afficher les récompenses
    const rewardsDiv = document.getElementById('rewards');
    if (data.rewards.length > 0) {
      data.rewards.forEach(reward => {
        const rewardElem = document.createElement('div');
        rewardElem.className = 'reward';
        rewardElem.innerText = reward;
        rewardsDiv.appendChild(rewardElem);
      });
    } else {
      rewardsDiv.innerHTML = '<p>Aucune récompense pour le moment. Jouez pour en débloquer !</p>';
    }
  });
