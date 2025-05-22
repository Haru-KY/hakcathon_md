document.querySelector('.btn').addEventListener('click', function () {
    document.getElementById('menu').classList.toggle('close');
});

// document.querySelectorAll('.fav-btn').forEach(function (btn) {
//     btn.addEventListener('click', function (e) {
//         e.stopPropagation();
//         btn.classList.toggle('active');
//     });
// });

//todoの複数同時表示　可
// document.querySelectorAll('.todo-description').forEach(function (desc, index) {
//     desc.addEventListener('click', function () {
//         const todoLists = document.querySelectorAll('.summary-list');
//         const targetList = todoLists[index]; // 対応する todo-list を取得
//         targetList.classList.toggle('show');

//     });
// });

document.addEventListener("DOMContentLoaded", function () {
  document.querySelectorAll('.todo-description').forEach(function (desc) {
    desc.addEventListener('click', function () {
      const emailBlock = desc.closest('.email-block');
      const todoList = emailBlock.querySelector('.summary-list');
      if (todoList) {
        todoList.classList.toggle('show');
      }
    });
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

// document.addEventListener("DOMContentLoaded", function () {
//     const form = document.querySelector('form');
//     const input = document.getElementById('tag-add');
//     const tagList = document.querySelector('.tag-list');

//     form.addEventListener('submit', function (event) {
//         event.preventDefault();
//         const value = input.value.trim();

//         if (value !== "") {
//             const li = document.createElement('li');
//             const a = document.createElement('a');
//             a.href = "#";
//             a.textContent = value;

//             const deleteBtn = document.createElement('button');
//             deleteBtn.textContent = "✖";
//             deleteBtn.className = "delete-btn";
//             deleteBtn.style.marginLeft = "8px";
//             deleteBtn.addEventListener('click', function () {
//                 li.remove();
//             });

//             li.appendChild(a);
//             li.appendChild(deleteBtn);
//             tagList.appendChild(li);

//             input.value = "";
//         }
//     });
// });

document.addEventListener("DOMContentLoaded", function () {
    const inputs = document.querySelectorAll('#utag, #aitag');
    inputs.forEach(input => {
        input.addEventListener("input", () => {
            console.log(`入力中: ${input.value}`);
        });
    });
});

document.querySelector('.tag-btn-ai').addEventListener('click', function () {
    document.querySelector('.tag-list-ai').classList.toggle('show');
    document.querySelector('.open-close-ai').classList.toggle('active');
});
document.querySelector('.tag-list-ai').addEventListener('click', (e) => {
    e.stopPropagation();
});

// document.getElementById('ai-submit').addEventListener('click', function () {
//     const input = document.getElementById('tag-add');
//     const value = input.value.trim();
//     const tagListAI = document.querySelector('.tag-list-ai');

//     if (value !== "") {
//         const li = document.createElement('li');
//         const a = document.createElement('a');
//         a.href = "#";
//         a.textContent = value;

//         const deleteBtn = document.createElement('button');
//         deleteBtn.textContent = "✖";
//         deleteBtn.className = "delete-btn";
//         deleteBtn.style.marginLeft = "8px";
//         deleteBtn.addEventListener('click', function () {
//             li.remove();
//         });

//         li.appendChild(a);
//         li.appendChild(deleteBtn);
//         tagListAI.appendChild(li);

//         input.value = "";
//     }
// });

//原文表示切り替え
document.addEventListener('click', function (e) {
    if (e.target.classList.contains('toggle-original')) {
        const summary = e.target.closest('.summary');
        const original = summary.nextElementSibling;
        summary.style.display = 'none';
        original.style.display = 'block';
    }

    if (e.target.classList.contains('toggle-summary')) {
        const original = e.target.closest('.original');
        const summary = original.previousElementSibling;
        original.style.display = 'none';
        summary.style.display = 'block';
    }
});