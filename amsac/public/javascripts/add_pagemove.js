document.querySelector('.btn').addEventListener('click', function () {
    document.getElementById('menu').classList.toggle('close');
});

document.querySelectorAll('.fav-btn').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
        e.stopPropagation();
        btn.classList.toggle('active');
    });
});

//todoの複数同時表示　可
document.querySelectorAll('.todo-description').forEach(function (desc, index) {
    desc.addEventListener('click', function () {
        const todoLists = document.querySelectorAll('.todo-list');
        const targetList = todoLists[index]; // 対応する todo-list を取得
        targetList.classList.toggle('show');

    });
});

//todoの複数同時表示　不可(他タブは閉じる)
// document.querySelectorAll('.todo-description').forEach(function (desc, index) {
//     desc.addEventListener('click', function () {
//         const todoLists = document.querySelectorAll('.todo-list');
//         todoLists.forEach((list, i) => {
//             if (i !== index) list.classList.remove('show');
//         });

//         todoLists[index].classList.toggle('show');
//     });
// });

document.querySelector('.tag-btn').addEventListener('click', function () {
    document.querySelector('.tag-list').classList.toggle('show');
    document.querySelector('.open-close').classList.toggle('active');
});
document.querySelector('.tag-list').addEventListener('click', (e) => {
    e.stopPropagation();
});

document.addEventListener("DOMContentLoaded", function () {
    const form = document.querySelector('form');
    const input = document.getElementById('tag-add');
    const tagList = document.querySelector('.tag-list');

    form.addEventListener('submit', function (event) {
        event.preventDefault();
        const value = input.value.trim();

        if (value !== "") {
            const li = document.createElement('li');
            const a = document.createElement('a');
            a.href = "#";
            a.textContent = value;

            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = "✖";
            deleteBtn.className = "delete-btn";
            deleteBtn.style.marginLeft = "8px";
            deleteBtn.addEventListener('click', function () {
                li.remove();
            });

            li.appendChild(a);
            li.appendChild(deleteBtn);
            tagList.appendChild(li);

            input.value = "";
        }
    });
});

document.querySelector('.tag-btn-ai').addEventListener('click', function () {
    document.querySelector('.tag-list-ai').classList.toggle('show');
    document.querySelector('.open-close-ai').classList.toggle('active');
});
document.querySelector('.tag-list-ai').addEventListener('click', (e) => {
    e.stopPropagation();
});

document.getElementById('ai-submit').addEventListener('click', function () {
    const input = document.getElementById('tag-add');
    const value = input.value.trim();
    const tagListAI = document.querySelector('.tag-list-ai');

    if (value !== "") {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = "#";
        a.textContent = value;

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = "✖";
        deleteBtn.className = "delete-btn";
        deleteBtn.style.marginLeft = "8px";
        deleteBtn.addEventListener('click', function () {
            li.remove();
        });

        li.appendChild(a);
        li.appendChild(deleteBtn);
        tagListAI.appendChild(li);

        input.value = "";
    }
});

