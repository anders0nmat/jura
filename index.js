function debounce(func, wait, immediate = false) {
    var timeout;
    return function (...args) {
        var context = this;
        var later = function () {
            timeout = null;
            if (!immediate)
                func.apply(context, args);
        };
        var callNow = immediate && !timeout;
        clearTimeout(timeout ?? undefined);
        timeout = setTimeout(later, wait);
        if (callNow)
            func.apply(context, args);
    };
}
function enableCors(url) {
    return `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(url)}`;
}
const lawbooks = [];
const law = document.getElementById('law');
const lawbook = document.querySelector('h2');
const lawbookLong = document.querySelector('h3');
const search = document.querySelector('#book-search');
const searchResults = document.querySelector('#search-results');
let active_book;
let active_law = 0;
async function load_books() {
    const response = await fetch(enableCors('https://gadi.netlify.app/'));
    if (!response.ok) {
        return;
    }
    const bodyHtml = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(bodyHtml, 'text/html');
    doc.querySelectorAll('main ul:nth-of-type(2) li a').forEach(e => {
        const href = e.href.match(/([^/]+)\.[^/\.]+$/)?.[1] ?? '';
        const lawTitle = e.parentElement?.childNodes[3].textContent;
        lawbooks.push([e.textContent, lawTitle ?? '', href]);
    });
}
async function load_law(slug) {
    const response = await fetch(enableCors('https://gadi.netlify.app/laws/' + slug + '.json'));
    const json = await response.json();
    active_book = json.data;
    active_book.contents = active_book.contents.filter(e => e.type == "article");
    active_law = 0;
    display_law();
}
function display_law() {
    const l = active_book.contents[active_law];
    law.querySelector('h4').textContent = l.name + (l.title ? " " + l.title : "");
    law.querySelector('#body').innerHTML = l.type == "article" ? l.body : '';
    if (active_book.titleShort) {
        lawbook.textContent = `${active_book.titleShort} (${active_book.abbreviation})`;
        lawbookLong.textContent = active_book.titleLong;
        lawbookLong.style.display = '';
    }
    else {
        lawbook.textContent = `${active_book.titleLong} (${active_book.abbreviation})`;
        lawbookLong.style.display = 'none';
    }
}
load_books();
await load_law('gg');
document.addEventListener('keydown', e => {
    if (e.defaultPrevented) {
        return;
    }
    if (e.target instanceof HTMLInputElement) {
        return;
    }
    if (e.key.length == 1) {
        search.value = '';
        search.focus();
    }
    if (e.key == "ArrowLeft") {
        active_law -= 1;
        if (active_law < 0) {
            active_law = 0;
        }
        display_law();
    }
    if (e.key == "ArrowRight") {
        const m = active_book.contents.length;
        active_law += 1;
        if (active_law >= m) {
            active_law = m - 1;
        }
        display_law();
    }
});
search.addEventListener('input', debounce(_ => {
    const value = search.value.toLowerCase();
    searchResults.replaceChildren();
    if (!value) {
        return;
    }
    const priorities = new Map();
    // Is there some matching lawitem in the current book?
    active_book.contents.forEach((e, idx) => {
        let score = 0;
        if (e.name.toLowerCase().includes(value)) {
            score += 1;
        }
        if (e.name.match(`\b${RegExp.escape(value)}\b}`)) {
            score += 100;
        }
        if (score > 0) {
            const li = document.createElement('span');
            li.textContent = e.name + ' ' + (e.title ?? '');
            li.dataset.index = idx.toString();
            if (!priorities.has(-score)) {
                priorities.set(-score, []);
            }
            priorities.get(-score)?.push(li);
        }
    });
    // is there a matching law book?
    lawbooks.forEach(e => {
        let score = 0;
        const content = e[0].toLowerCase() + ' ' + e[1].toLowerCase();
        if (content.includes(value)) {
            score += 1;
        }
        if (value && content.startsWith(value)) {
            score += 10;
        }
        if (score > 0) {
            const li = document.createElement('span');
            li.textContent = e[0];
            if (e[1]) {
                const li2 = document.createElement('span');
                li2.textContent = e[1];
                li.append(li2);
            }
            li.dataset.slug = e[2];
            if (!priorities.has(score)) {
                priorities.set(score, []);
            }
            priorities.get(score)?.push(li);
        }
    });
    const prioClass = Array.from(priorities.keys()).sort((a, b) => {
        const aPos = a < 0 ? 0 : 1;
        const bPos = b < 0 ? 0 : 1;
        if (aPos !== bPos) {
            return aPos - bPos;
        }
        return Math.abs(b) - Math.abs(a);
    });
    prioClass.forEach(prio => {
        searchResults.append(...priorities.get(prio));
    });
    if (searchResults.firstElementChild) {
        searchResults.firstElementChild.id = 'selected';
    }
}, 100));
search.addEventListener('keydown', e => {
    if (e.key == "ArrowDown") {
        e.preventDefault();
        const sel = searchResults.querySelector('#selected');
        if (sel) {
            sel.id = '';
            if (sel.nextElementSibling) {
                sel.nextElementSibling.id = 'selected';
            }
            else {
                // end of list
                searchResults.firstElementChild.id = 'selected';
            }
        }
    }
    if (e.key == "ArrowUp") {
        e.preventDefault();
        const sel = searchResults.querySelector('#selected');
        if (sel) {
            sel.id = '';
            if (sel.previousElementSibling) {
                sel.previousElementSibling.id = 'selected';
            }
            else {
                // end of list
                searchResults.lastElementChild.id = 'selected';
            }
        }
    }
    if (e.key == "Enter") {
        const sel = searchResults.querySelector('#selected');
        if (sel) {
            if ('index' in sel.dataset) {
                active_law = parseInt(sel.dataset.index);
                display_law();
                search.blur();
            }
            else if ('slug' in sel.dataset) {
                load_law(sel.dataset.slug).then(_ => {
                    active_law = 0;
                    display_law();
                    search.blur();
                });
            }
        }
    }
    if (e.key == "Escape") {
        search.blur();
    }
});
search.addEventListener('blur', _ => {
    search.value = '';
    searchResults.replaceChildren();
});
export {};
