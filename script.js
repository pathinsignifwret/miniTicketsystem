const ticketInput = document.getElementById('ticketInput');
const priorityInput = document.getElementById('priorityInput');
const ticketList = document.getElementById('ticketList');
const emptyMessage = document.getElementById('emptyMessage');

const API_URL = 'http://localhost:3000/api/tickets';

// load tickets from db
async function loadTickets() {
    try {
        const response = await fetch(API_URL);
        const tickets = await response.json();
        
        // delete all existing tickets from the list before rendering new ones
        ticketList.innerHTML = '';
        
        if (tickets.length === 0) {
            showEmptyMessage(true);
            return;
        }

        showEmptyMessage(false);

        // render tickets
        tickets.forEach(ticket => {
            renderTicket(ticket);
        });
    } catch (error) {
        console.error('Fehler beim Laden:', error);
        alert('Server ist nicht aktiv.');
    }
}

// render ticket in the list
function renderTicket(ticket) {
    const date = new Date(ticket.erstellungsdatum).toLocaleDateString('de-DE');
    
    // status class based on ticket status
    let statusClass = 'status-offen';
    if (ticket.status === 'In Arbeit') {
        statusClass = 'status-in-arbeit';
    } else if (ticket.status === 'Fertig') {
        statusClass = 'status-fertig';
    }

    const li = document.createElement('li');
    li.className = 'ticket-item';
    li.dataset.id = ticket.id;

    li.innerHTML = `
        <div class="ticket-info">
            <strong>${ticket.problem}</strong>
            <div class="ticket-details">
                <span class="badge status-badge ${statusClass}">
                    Status: 
                    <select class="status-select" onchange="updateTicketStatus(${ticket.id}, this)">
                        <option value="Offen" ${ticket.status === 'Offen' ? 'selected' : ''}>Offen</option>
                        <option value="In Arbeit" ${ticket.status === 'In Arbeit' ? 'selected' : ''}>In Arbeit</option>
                        <option value="Fertig" ${ticket.status === 'Fertig' ? 'selected' : ''}>Fertig</option>
                    </select>
                </span>
                <span class="badge priority">Priorität: ${ticket.prioritaet}</span>
                <span class="badge date">Datum: ${date}</span>
            </div>
        </div>
        <button class="delete-btn" onclick="deleteTicketFromServer(${ticket.id})">Löschen</button>
    `;

    ticketList.appendChild(li);
}

// 2. add ticket to server (and DB)
async function addTicket() {
    const text = ticketInput.value.trim();
    const priority = priorityInput.value;

    if (text === '') {
        alert('Bitte schreiben Sie ein Problem.');
        return;
    }

    const newTicket = {
        problem: text,
        status: 'Offen',
        prioritaet: priority
    };

    try {
        // POST request
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newTicket)
        });

        if (response.ok) {
            const savedTicket = await response.json();
            
            // "Es gibt noch keine Tickets"
            showEmptyMessage(false);
            
            // ticket rendern on monitor
            renderTicket(savedTicket);
            
            // clear fields
            ticketInput.value = '';
            priorityInput.value = 'Normal';
        }
    } catch (error) {
        console.error('Fehler beim Speichern:', error);
    }
}

// status change und in db save
async function updateTicketStatus(id, selectElement) {
    const newStatus = selectElement.value;
    
    try {
        const response = await fetch(`${API_URL}/${id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });

        if (response.ok) {
            // parent
            const badge = selectElement.closest('.status-badge');
            
            // alter Klassen entfernen
            badge.classList.remove('status-offen', 'status-in-arbeit', 'status-fertig');
            
            // neu klasse 
            if (newStatus === 'Offen') {
                badge.classList.add('status-offen');
            } else if (newStatus === 'In Arbeit') {
                badge.classList.add('status-in-arbeit');
            } else if (newStatus === 'Fertig') {
                badge.classList.add('status-fertig');
            }
        } else {
            alert('Fehler beim Speichern des neuen Status.');
        }
    } catch (error) {
        console.error('Fehler beim Ändern des Status:', error);
    }
}

async function deleteTicketFromServer(id) {
    try {
        const response = await fetch(`${API_URL}/${id}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            // delete ticket from the list in the browser
            const ticketElement = document.querySelector(`[data-id="${id}"]`);
            if (ticketElement) {
                ticketElement.remove();
            }

            // Wenn liste leer ist, zeiget Nachricht wieder
            if (ticketList.children.length === 0) {
                showEmptyMessage(true);
            }
        }
    } catch (error) {
        console.error('Fehler beim Löschen:', error);
    }
}

// Leer Nachricht
function showEmptyMessage(show) {
    if (show) {
        ticketList.innerHTML = `<li class="empty-message" id="emptyMessage">Es gibt noch keine Tickets. Alles ist super!</li>`;
    } else {
        const msg = document.getElementById('emptyMessage');
        if (msg) msg.remove();
    }
}

//enter
ticketInput.addEventListener('keypress', function(event) {
    if (event.key === 'Enter') {
        addTicket();
    }
});


loadTickets();