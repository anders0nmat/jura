
export {}

declare global {
    interface RegExpConstructor {
        escape(str: string): string;
    }
}

interface PublicationInfo {}
interface StatusInfo {}
interface Notes {
    body: string | null
    footnotes: string | null
    documentaryFootnotes: string | null
}

interface LawItem {
    type: string
    id: string
    name: string
    title: string
    parent: {
        type: string
        id: string
    } | null
    footnotes: string | null
    documentaryFootnotes: string | null
}

interface Heading extends LawItem {
    type: "heading"
}

interface Article extends LawItem {
    type: "article"
    body: string
}

interface Law {
    type: "law"
    id: string
    firstPublished: string
    sourceTimestamp: string
    titleShort: string | null
    titleLong: string
    abbreviation: string
    slug: string
    extraAbbreviation: string[]
    publicationInfo: PublicationInfo[]
    statusInfo: StatusInfo[]
    notes: Notes
    attachments: any
    contents: (Heading | Article)[]
}

function debounce<Args extends any[], F extends (...args: Args) => any>(func: F, wait: number, immediate: boolean = false) {
    var timeout: ReturnType<typeof setTimeout> | null
    return function(this: ThisParameterType<F>, ...args: Parameters<F>) {
		var context = this
        var later = function() {
            timeout = null
            if (!immediate) func.apply(context, args)
        }
        var callNow = immediate && !timeout
        clearTimeout(timeout ?? undefined)
        timeout = setTimeout(later, wait)
        if (callNow) func.apply(context, args)
    }
}

function enableCors(url: string) {
    return `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(url)}`
}

const CACHE = await caches.open('v1')
async function fetchCached(request: RequestInfo | URL) {
    const cachedResponse = await CACHE.match(request)
    if (cachedResponse) {
        const cachedAt = cachedResponse.headers.get('X-Cached-At')
        const cachedAge = Date.now() - Date.parse(cachedAt ?? '0')
        const MAX_AGE = 7 * 24 * 60 * 60 * 1000
        if (cachedAge < MAX_AGE) {
            console.log(`Cache hit for ${request}`)
            return cachedResponse
        }
    }
    console.log(`Cache miss for ${request}`)

    const response = await fetch(request)
    const responseBody = await response.arrayBuffer()
    const res = new Response(responseBody, {
        status: response.status,
        statusText: response.statusText,
        headers: {
            ...response.headers,
            'X-Cached-At': new Date().toISOString(),
        }
    })
    CACHE.put(request, res.clone())
    return res
}

const lawbooks: [string, string, string][] = []
const law = document.getElementById('law')!
const lawbook = document.querySelector('#law-title')!
const lawbookLong = document.querySelector('h3')!
const search = document.querySelector<HTMLInputElement>('#book-search')!
const searchResults = document.querySelector<HTMLElement>('#search-results')!
const searchLaws = searchResults.querySelector<HTMLElement>('#laws')!
const searchLawbooks = searchResults.querySelector<HTMLElement>('#lawbooks')!
const searchGroups = Array.from(searchResults.querySelectorAll<HTMLElement>('.search-group'))
const toc = document.querySelector<HTMLElement>('#toc')!
const pinned = document.querySelector<HTMLElement>('#pinned')!
let active_book: Law
let active_law = 0


let pinnedLaws: {book: string, index: number, title: string}[] = JSON.parse(localStorage.getItem('pinned') ?? '[]')


async function load_books() {
    const response = await fetchCached(enableCors('https://gadi.netlify.app/'))

    if (!response.ok) {
        return
    }
    const bodyHtml = await response.text()

    const parser = new DOMParser()
    const doc = parser.parseFromString(bodyHtml, 'text/html')

    doc.querySelectorAll<HTMLAnchorElement>('main ul:nth-of-type(2) li a').forEach(e => {
        const href = e.href.match(/([^/]+)\.[^/\.]+$/)?.[1] ?? ''
        const lawTitle = e.parentElement?.childNodes[3].textContent
        lawbooks.push([e.textContent, lawTitle ?? '', href])
    })
}

async function load_law(slug: string) {
    const response = await fetchCached(enableCors('https://gadi.netlify.app/laws/' + slug + '.json'))
    const json = await response.json()
    active_book = json.data
    active_book.contents = active_book.contents.filter(e => e.type == "article")
    active_law = 0
    display_lawbook()
    display_law()
}

function display_lawbook() {
    toc.replaceChildren()

    active_book.contents.forEach((e, idx) => {
        const li = document.createElement('li')
        const a = document.createElement('a')
        a.textContent = e.name + (e.title ? ' ' + e.title : '')
        a.href = `#${active_book.slug}-${idx}`
        li.append(a)
        toc.append(li)
    })
}

function display_law() {
    const l = active_book.contents[active_law]
    law.querySelector('h4')!.textContent = l.name + (l.title ? " " + l.title : "")
    law.querySelector('#body')!.innerHTML = l.type == "article" ? l.body : ''

    if (active_book.titleShort) {
        lawbook.textContent = `${active_book.titleShort} (${active_book.abbreviation})`
        lawbookLong.textContent = active_book.titleLong
        lawbookLong.style.display = ''
    }
    else {
        lawbook.textContent = `${active_book.titleLong} (${active_book.abbreviation})`
        lawbookLong.style.display = 'none'
    }

    toc.querySelectorAll('.selected').forEach(e => e.classList.remove('selected'))
    const tocElement = toc.querySelector(`[href$="-${active_law}"]`)
    tocElement?.parentElement?.classList.add('selected')
    tocElement?.scrollIntoView({
        'block': 'nearest',
    })

    pinned.querySelectorAll('.selected').forEach(e => e.classList.remove('selected'))
    pinned.querySelectorAll(`[href^="#${active_book.slug}-"][href$="-${active_law}"]`).forEach(e => e.parentElement?.classList.add('selected'))
    pinned.querySelector('.selected')?.scrollIntoView({
        'block': 'nearest',
    })
}

function display_pinned() {
    pinned.replaceChildren()

    pinnedLaws.forEach(e => {
        const li = document.createElement('li')
        const a = document.createElement('a')
        a.textContent = e.title
        a.href = `#${e.book}-${e.index}`
        if (active_book.slug == e.book && active_law == e.index) {
            li.classList.add('selected')
        }
        li.append(a)
        pinned.append(li)
    })
}

function pin_law() {
    const book = active_book.slug
    const index = active_law
    const law = active_book.contents[active_law]

    const pinnedIndex = pinnedLaws.findIndex(e => e.book == book && e.index == index)
    if (pinnedIndex < 0) {
        pinnedLaws.push({
            book,
            index,
            title: `${active_book.abbreviation} ${law.name}` + (law.title ? ' ' + law.title : '')
        })
    }
    else {
        pinnedLaws.splice(pinnedIndex, 1)
    }

    localStorage.setItem('pinned', JSON.stringify(pinnedLaws))
    display_pinned()
}

async function load_hash() {
    const parts = location.hash.substring(1).split('-', 2) ?? ['gg', '0']
    const book = parts[0]
    const index = parseInt(parts[1])

    if (!active_book || active_book.slug !== book) {
        await load_law(book)
    }
    active_law = index
    display_law()

    search.value = ''
    search.blur()
    searchLaws.replaceChildren()
    searchLawbooks.replaceChildren()
}



load_books()

window.addEventListener('hashchange', load_hash)

if (!location.hash) {
    location.assign('#gg-0')
}
await load_hash()
display_pinned()



document.addEventListener('keydown', e => {
    if (e.defaultPrevented) { return }
    if (e.target instanceof HTMLInputElement) { return }

    if (e.key.length == 1) {
        e.preventDefault()
        search.value = e.key
        search.focus()
        search.dispatchEvent(new Event('input'))
    }

    if (e.key == "ArrowLeft") {
        if (e.ctrlKey) {
            const current = pinned.querySelector('.selected')

            current?.classList.remove('selected')
            if (current?.previousElementSibling) {
                current.previousElementSibling.classList.add('selected')
            }
            else {
                pinned.lastElementChild?.classList.add('selected')
            }
        }
        else {   
            location.assign(`#${active_book.slug}-${Math.max(active_law - 1, 0)}`)
        }
    }

    if (e.key == "ArrowRight") {
        if (e.ctrlKey) {
            const current = pinned.querySelector('.selected')

            current?.classList.remove('selected')
            if (current?.nextElementSibling) {
                current.nextElementSibling.classList.add('selected')
            }
            else {
                pinned.firstElementChild?.classList.add('selected')
            }
        }
        else {
            location.assign(`#${active_book.slug}-${Math.min(active_law + 1, active_book.contents.length - 1)}`)
        }
    }

    if (e.key == "Enter") {
        pin_law()
    }

    if (e.key == "Escape" && e.ctrlKey) {
        pinned.querySelector('.selected')?.classList.remove('selected')
    }
})

document.addEventListener('keyup', async e => {
    if (e.key == "Control") {
        const current = pinned.querySelector<HTMLAnchorElement>('.selected > a')
        if (current) {
            location.assign(current.href)
        }
        else {
            display_law()
        }
    }
})

search.addEventListener('input', debounce(_ => {
    const value = search.value.toLowerCase()

    searchLaws.replaceChildren()
    searchLawbooks.replaceChildren()

    if (!value) { return }

    // Is there some matching lawitem in the current book?
    active_book.contents
        .map((e, idx): [number, HTMLElement] | null => {
            let score = 0
            if (e.name.toLowerCase().includes(value)) {
                score += 1
            }

            if (e.name.match(`\b${RegExp.escape(value)}\b}`)) {
                score += 100
            }

            if (score > 0) {
                const a = document.createElement('a')
                a.textContent = e.name + ' ' + (e.title ?? '')
                a.href = `#${active_book.slug}-${idx}`
                return [score, a]
            }
            return null
        })
        .filter(e => e !== null)
        .sort(([a, _], [b, _2]) => b - a)
        .forEach(([_, e]) => searchLaws.append(e))

    // is there a matching law book?
    lawbooks
        .map((e): [number, HTMLElement] | null => {
            let score = 0
            const content = e[0].toLowerCase() + ' ' + e[1].toLowerCase()
            if (content.includes(value)) {
                score += 1
            }
            if (value && content.startsWith(value)) {
                score += 10
            }

            if (score > 0) {
                const a = document.createElement('a')
                a.textContent = e[0]
                if (e[1]) {
                    const span = document.createElement('span')
                    span.textContent = e[1]
                    a.append(span)
                }
                a.href = `#${e[2]}-0`

                return [score, a]
            }
            return null
        })
        .filter(e => e !== null)
        .sort(([a, _], [b, _2]) => b - a)
        .slice(0, 10)
        .forEach(([_, e]) => searchLawbooks.append(e))

    if (searchLaws.firstElementChild) {
        searchLaws.firstElementChild.id = 'selected'
    }
    else if (searchLawbooks.firstElementChild) {
        searchLawbooks.firstElementChild.id = 'selected'
    }

    
    searchResults.querySelector<HTMLElement>('#selected')?.scrollIntoView({
        'block': 'nearest',
    })
}, 100))

function getGroup(current: HTMLElement, advance: number): HTMLElement {
    const idx = searchGroups.findIndex(e => e === current)
    if (idx < 0) {
        return current
    }
    const wrap = (x: number) => 
        x < 0
            ? searchGroups.length - 1
            : x >= searchGroups.length
                ? 0
                : x

    for (let i = wrap(idx + advance); i !== idx; i = wrap(i + advance)) {
        const nextElement = searchGroups[i]
        if (nextElement.childElementCount > 0) {
            return nextElement
        }
    }
    return current
}

search.addEventListener('keydown', e => {
    if (e.key == "ArrowDown") {
        e.preventDefault()
        const sel = searchResults.querySelector<HTMLElement>('#selected')
        if (sel) {
            const nextGroup = getGroup(sel.parentElement!, 1)
            sel.id = ''
            if (sel.nextElementSibling) {
                sel.nextElementSibling.id = 'selected'
            }
            else if (nextGroup.firstElementChild) {
                nextGroup.firstElementChild.id = 'selected'
            }
        }
        searchResults.querySelector<HTMLElement>('#selected')?.scrollIntoView({
            'block': 'nearest',
        })
    }

    if (e.key == "ArrowUp") {
        e.preventDefault()
        const sel = searchResults.querySelector<HTMLElement>('#selected')
        if (sel) {
            const nextGroup = getGroup(sel.parentElement!, -1)
            sel.id = ''
            if (sel.previousElementSibling) {
                sel.previousElementSibling.id = 'selected'
            }
            else if (nextGroup.lastElementChild) {
                nextGroup.lastElementChild.id = 'selected'
            }
        }

        searchResults.querySelector<HTMLElement>('#selected')?.scrollIntoView({
            'block': 'nearest',
        })
    }

    if (e.key == "Enter") {
        const sel = searchResults.querySelector<HTMLAnchorElement>('#selected')
        if (sel) {
            location.assign(sel.href)
        }
    }

    if (e.key == "Escape") {
        search.blur()
    }
})


