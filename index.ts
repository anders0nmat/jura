
const API_BASE = "https://de.openlegaldata.io/"

function enableCors(url) {
    return `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`
}

async function fetchLaws() {
    const url = enableCors("https://de.openlegaldata.io/api/laws/?book__latest=true&book__slug=gg&limit=5")
    return fetch(url)
        .then(e => {
            return e.text()
        })
        .then(e => {
            document.getElementById("logs").textContent += "API Result is " + e
            return JSON.parse(e)
        })
        .catch(e => document.getElementById("logs").textContent += e.toString())
}

async function fetchApi(endpoint: string, args: {[key:string]: string} = {}): Promise<any> {
    const components = new URLSearchParams(args)
    const url = API_BASE + 'api/' + endpoint + components.toString()
    const corsUrl = enableCors(url)
    return fetch(corsUrl).then(e => e.json())
}

const lawCard = document.getElementById("law")

function loadLaw(id: number) {
    fetchApi(`laws/${id}`)
        .then(e => {
            lawCard.dataset.id = e.id
            lawCard.querySelector("h4").textContent = e.title
            lawCard.querySelector("#body").innerHTML = e.content
        })
}

loadLaw(154853)

document.addEventListener("keydown", e => {
    if (e.key == "ArrowLeft") {
        const currentLaw = parseInt(lawCard.dataset.id)
        loadLaw(currentLaw - 1)
    }
    else if (e.key == "ArrowRight") {
        const currentLaw = parseInt(lawCard.dataset.id)
        loadLaw(currentLaw + 1)
    }
})

