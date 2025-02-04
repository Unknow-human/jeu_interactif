// public/js/leaderboard.js
fetch('/leaderboardData')
  .then(response => response.json())
  .then(data => {
    const leaderboard = document.getElementById('leaderboard');
    data.forEach((user, index) => {
      leaderboard.innerHTML += `
        <tr>
          <td>${index + 1}</td>
          <td>${user.username}</td>
          <td>${user.score}</td>
        </tr>
      `;
    });
  });
