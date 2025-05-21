document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.fav-btn').forEach(function (btn) {
        btn.addEventListener('click', async function (e) {
            e.stopPropagation();  // メール開閉と競合しないようにする
            const emailId = btn.getAttribute('data-id');

            try {
                const response = await fetch('/favorite', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ emailId }),
                    credentials: 'same-origin'
                });

                const result = await response.json();
                console.log('Favorite API response: ', result);

                if (result.success) {
                    if (result.newStatus) {
                        btn.classList.add('active');
                        btn.textContent = '★';
                    } else {
                        btn.classList.remove('active');
                        btn.textContent = '☆';
                    }
                } else {
                    alert('お気に入りの更新に失敗しました');
                }
            } catch (err) {
                console.error('通信エラー:', err);
                alert('通信エラーが発生しました');
            }
        });
    });
});
