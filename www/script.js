'use strict';

const DEFAULT_CODES = {
	P0100: ['Circuit débitmètre d’air', 'Contrôlez le connecteur, le faisceau et le capteur de débit d’air.'],
	P0101: ['Plage de performance du débitmètre', 'Vérifiez une prise d’air et comparez les valeurs du débitmètre.'],
	P0113: ['Température d’air d’admission élevée', 'Contrôlez le capteur de température, sa prise et son circuit.'],
	P0171: ['Mélange trop pauvre, banc 1', 'Rechercher une fuite d’admission ou un défaut d’alimentation.'],
	P0172: ['Mélange trop riche, banc 1', 'Vérifiez pression, injecteurs et mesure du débit d’air.'],
	P0201: ['Circuit injecteur, cylindre 1', 'Contrôlez le circuit électrique de l’injecteur du cylindre 1.'],
	P0300: ['Ratés de combustion aléatoires', 'Contrôler allumage, alimentation et compression.'],
	P0301: ['Ratés de combustion, cylindre 1', 'Contrôlez bougie, bobine, injecteur et compression du cylindre 1.'],
	P0302: ['Ratés de combustion, cylindre 2', 'Contrôlez bougie, bobine, injecteur et compression du cylindre 2.'],
	P0303: ['Ratés de combustion, cylindre 3', 'Contrôlez bougie, bobine, injecteur et compression du cylindre 3.'],
	P0304: ['Ratés de combustion, cylindre 4', 'Contrôlez bougie, bobine, injecteur et compression du cylindre 4.'],
	P0401: ['Débit EGR insuffisant', 'Vérifiez la vanne EGR et ses conduits.'],
	P0442: ['Petite fuite du système EVAP', 'Inspectez le bouchon de carburant et le circuit de récupération des vapeurs.'],
	P0455: ['Fuite importante du système EVAP', 'Inspectez le bouchon, les durites et le circuit EVAP.'],
	P0500: ['Signal capteur de vitesse véhicule', 'Contrôlez le capteur de vitesse, sa connectique et son faisceau.'],
	P0420: ['Rendement catalyseur faible', 'Contrôler les sondes lambda et le catalyseur.'],
	P0562: ['Tension système trop basse', 'Contrôler batterie, alternateur et masses.'],
	P0563: ['Tension système trop élevée', 'Faites vérifier le régulateur de l’alternateur.'],
	P0606: ['Processeur du calculateur moteur', 'Vérifiez alimentation et masses avant d’envisager un remplacement.'],
	P0700: ['Commande de transmission', 'Un diagnostic du calculateur de boîte est nécessaire.'],
	P0087: ['Pression de carburant trop basse', 'Contrôlez filtre, pompe, capteur et alimentation.'],
	P0130: ['Circuit sonde lambda amont', 'Vérifiez le faisceau et la sonde lambda.'],
	P0135: ['Chauffage sonde lambda', 'Contrôlez le circuit de chauffage de la sonde lambda.'],
	P0299: ['Pression de suralimentation insuffisante', 'Inspectez durites, commande et turbocompresseur.'],
	P0335: ['Capteur de position vilebrequin', 'Vérifiez le capteur, le faisceau et la cible.'],
	P0340: ['Capteur de position arbre à cames', 'Contrôlez le capteur, son connecteur et la distribution.'],
	P0409: ['Circuit capteur EGR', 'Vérifiez alimentation, faisceau et vanne EGR.'],
	P0480: ['Commande ventilateur refroidissement', 'Contrôlez relais, fusible et moteur du ventilateur.'],
	P0705: ['Capteur de gamme de transmission', 'Vérifiez le capteur de gamme de boîte et son réglage.'],
	P0715: ['Capteur vitesse entrée transmission', 'Contrôlez le capteur et le circuit de la boîte.'],
	P1000: ['Moniteurs de diagnostic non terminés', 'Les tests embarqués ne sont pas terminés depuis la dernière réinitialisation.'],
	P2002: ['Efficacité du filtre à particules', 'Vérifiez charge de suie, capteurs et régénération.'],
	P2096: ['Correction carburant aval trop pauvre', 'Contrôlez les fuites et les sondes lambda.'],
	P2195: ['Sonde lambda bloquée pauvre', 'Vérifiez sonde, circuit et étanchéité admission/échappement.'],
	P2279: ['Fuite d’air dans l’admission', 'Inspectez durites, joints et collecteur d’admission.'],
	P0234: ['Surpression turbocompresseur', 'Vérifiez commande de géométrie et actionneur du turbo.'],
	P2563: ['Capteur position commande turbo', 'Contrôlez actionneur, capteur et câblage du turbo.'],
};
const KEYS = { catalog: 'autoscan.catalog', history: 'autoscan.history', docs: 'autoscan.documents', vehicle: 'autoscan.vehicle' };
const DEMO_CODES = [
	{ code: 'P0420', status: 'Confirmé' },
	{ code: 'P0171', status: 'En attente' },
	{ code: 'P0301', status: 'Confirmé' },
];
const $ = (selector) => document.querySelector(selector);
const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const readStored = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
let catalog = readStored(KEYS.catalog, {});
let history = readStored(KEYS.history, []);
let documents = readStored(KEYS.docs, []);
const OPTIONS_KEY = 'autoscan.options';
let options = { darkMode: false, includePending: true, includePermanent: true, saveHistory: true, baudRate: 38400, ...readStored(OPTIONS_KEY, {}) };
let serialPort = null;
let activeResult = null;
let busy = false;

function decodeDtc(text, status) {
	const clean = text.replace(/\s/g, '').toUpperCase();
	const start = clean.indexOf('43');
	if (start < 0) return [];
	const data = clean.slice(start + 2);
	const results = [];
	for (let i = 0; i + 3 < data.length; i += 4) {
		const bytes = data.slice(i, i + 4);
		if (!/^[0-9A-F]{4}$/.test(bytes)) break;
		if (bytes === '0000') continue;
		const a = parseInt(bytes.slice(0, 2), 16);
		const b = parseInt(bytes.slice(2), 16);
		const family = ['P', 'C', 'B', 'U'][(a >> 6) & 3];
		const digits = `${(a >> 4) & 3}${(a & 15).toString(16)}${(b >> 4).toString(16)}${(b & 15).toString(16)}`;
		results.push({ code: `${family}${digits}`.toUpperCase(), status });
	}
	return results;
}

function codeInfo(code) {
	const item = catalog[code];
	const builtin = DEFAULT_CODES[code];
	return item || (builtin ? { title: builtin[0], description: builtin[1] } : { title: 'Code non répertorié', description: 'Importez un catalogue à jour ou consultez la documentation constructeur.' });
}

function catalogSize() {
	return new Set([...Object.keys(DEFAULT_CODES), ...Object.keys(catalog)]).size;
}

function vehicleInfo() {
	const make = $('#vehicle-make').value.trim();
	const model = $('#vehicle-model').value.trim();
	const plate = $('#vehicle-plate').value.trim().toUpperCase();
	return { make, model, plate, vin: $('#vehicle-vin').value.trim().toUpperCase(), label: [make, model].filter(Boolean).join(' ') || plate || 'Véhicule non renseigné' };
}

function connection(connected, label) {
	$('#connection-indicator').classList.toggle('connected', connected);
	$('#connection-indicator').classList.remove('connecting');
	$('#connection-label').textContent = label;
	$('#connect-button-label').textContent = connected ? 'Déconnecter' : 'Connecter l’adaptateur';
	$('#scan-button').disabled = !connected || busy;
}

function modal(title, content, kicker = 'INFORMATION') {
	$('#modal-title').textContent = title;
	$('#modal-kicker').textContent = kicker;
	$('#modal-content').innerHTML = content;
	$('#info-modal').showModal();
}

function renderHistory() {
	$('#history-body').innerHTML = history.length ? history.slice(0, 8).map((entry) => {
		const date = new Date(entry.date);
		const dateText = Number.isNaN(date.getTime()) ? 'Date inconnue' : new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' }).format(date);
		const faults = Number(entry.faults) || 0;
		return `<tr><td>${escapeHTML(dateText)}</td><td>${escapeHTML(entry.vehicle)}</td><td><span class="status-pill ${faults ? 'has-faults' : ''}">${faults ? `${faults} défaut${faults > 1 ? 's' : ''}` : 'Aucun défaut'}</span></td><td>${entry.demo ? 'Démo' : 'OBD-II'}</td></tr>`;
	}).join('') : '<tr class="history-empty"><td colspan="4">Aucun diagnostic enregistré pour le moment.</td></tr>';
}

function showResults(result) {
	activeResult = result;
	$('#empty-state').hidden = true;
	$('#fault-list').hidden = false;
	$('#export-button').disabled = false;
	$('#results-title').textContent = result.codes.length ? `${result.codes.length} anomalie${result.codes.length > 1 ? 's' : ''} détectée${result.codes.length > 1 ? 's' : ''}` : 'Aucune anomalie détectée';
	$('#faults-stat').textContent = String(result.codes.length);
	$('#last-scan-stat').textContent = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(new Date(result.date));
	const source = result.demo ? 'Simulation · données fictives' : `Lecture véhicule · ${result.vehicle.label}`;
	const cards = result.codes.map((item) => {
		const info = codeInfo(item.code);
		return `<article class="fault-card"><div class="fault-code">${escapeHTML(item.code)}</div><div><h3>${escapeHTML(info.title)}</h3><p>${escapeHTML(info.description)}</p></div><div class="fault-meta"><span class="severity-dot ${item.status === 'Confirmé' ? 'high' : ''}"></span>${escapeHTML(item.status)}</div></article>`;
	}).join('');
	$('#fault-list').innerHTML = `<div class="result-summary"><span class="summary-chip">${escapeHTML(source)}</span><span class="summary-chip ${result.codes.length ? 'warning' : ''}">${result.codes.length ? `${result.codes.length} code(s) à examiner` : 'Aucun DTC retourné'}</span></div>${cards || '<article class="fault-card"><div class="fault-code">OK</div><div><h3>Aucun code défaut retourné</h3><p>La lecture OBD-II standard n’a détecté aucun défaut mémorisé. Elle ne remplace pas un contrôle mécanique ni un diagnostic constructeur.</p></div><div class="fault-meta">RAS</div></article>'}`;
	if (options.saveHistory) {
		history.unshift({ date: result.date, vehicle: result.vehicle.label, faults: result.codes.length, demo: result.demo });
		history = history.slice(0, 30);
		localStorage.setItem(KEYS.history, JSON.stringify(history));
		renderHistory();
	}
}

function setProgress(percent, label) {
	$('#scan-progress').hidden = false;
	$('#progress-bar').style.width = `${percent}%`;
	$('#progress-percent').textContent = `${percent}%`;
	$('#progress-label').textContent = label;
}

async function elmCommand(writer, reader, cmd) {
	await writer.write(new TextEncoder().encode(`${cmd}\r`));
	let response = '';
	let timeout;
	try {
		const expired = new Promise((_, reject) => {
			timeout = setTimeout(() => reject(new Error(`L’adaptateur ne répond pas à ${cmd}.`)), 12000);
		});
		const readUntilPrompt = async () => {
			while (!response.includes('>')) {
				const { value, done } = await reader.read();
				if (done) throw new Error('La connexion série a été interrompue.');
				response += new TextDecoder().decode(value, { stream: true });
			}
			return response.replace(/>/g, '').trim();
		};
		return await Promise.race([readUntilPrompt(), expired]);
	} finally { clearTimeout(timeout); }
}

async function connectAdapter() {
	if (serialPort) {
		try { await serialPort.close(); } catch { /* Le port peut déjà être fermé. */ }
		serialPort = null;
		connection(false, 'Adaptateur déconnecté');
		return;
	}
	if (!('serial' in navigator)) {
		modal('Connexion USB indisponible', '<p>La connexion directe nécessite Chrome ou Edge sur ordinateur, en HTTPS (ou localhost), et un adaptateur OBD-II USB compatible ELM327.</p><p>USB-C est le type de prise : il faut un adaptateur OBD-II pour convertir les données du véhicule. Les adaptateurs Bluetooth classiques ne sont pas pris en charge.</p>', 'COMPATIBILITÉ');
		return;
	}
	try {
		$('#connection-indicator').classList.add('connecting');
		$('#connection-label').textContent = 'Sélection de l’adaptateur…';
		serialPort = await navigator.serial.requestPort();
		const baudRate = [9600, 38400, 115200].includes(Number(options.baudRate)) ? Number(options.baudRate) : 38400;
		await serialPort.open({ baudRate });
		connection(true, 'Adaptateur connecté');
	} catch (error) {
		serialPort = null;
		connection(false, error.name === 'NotFoundError' ? 'Connexion annulée' : 'Connexion impossible');
		if (error.name !== 'NotFoundError') modal('Connexion impossible', `<p>${escapeHTML(error.message || 'Impossible d’ouvrir ce port série.')}</p><p>Vérifiez le contact, l’adaptateur et qu’aucun autre logiciel n’utilise le port.</p>`, 'CONNEXION');
	}
}

async function runScan() {
	if (!serialPort || busy) return;
	busy = true;
	$('#scan-button').disabled = true;
	$('#connect-button').disabled = true;
	const writer = serialPort.writable.getWriter();
	const reader = serialPort.readable.getReader();
	try {
		const requests = [['ATE0', 'Préparation…', 10], ['ATL0', 'Configuration liaison…', 20], ['ATSP0', 'Détection protocole véhicule…', 32], ['0100', 'Vérification calculateurs…', 47], ['03', 'Défauts confirmés…', 64]];
		if (options.includePending) requests.push(['07', 'Défauts en attente…', 79]);
		if (options.includePermanent) requests.push(['0A', 'Défauts permanents…', 92]);
		const replies = {};
		for (const [cmd, label, percent] of requests) {
			setProgress(percent, label);
			replies[cmd] = await elmCommand(writer, reader, cmd);
			if (cmd === '0100' && /UNABLE TO CONNECT|CAN ERROR|BUS INIT/i.test(replies[cmd])) throw new Error('Le véhicule ne répond pas. Vérifiez le contact et la prise OBD-II.');
		}
		const codes = [...decodeDtc(replies['03'], 'Confirmé'), ...decodeDtc(replies['07'] || '', 'En attente'), ...decodeDtc(replies['0A'] || '', 'Permanent')];
		const unique = [...new Map(codes.map((item) => [`${item.code}:${item.status}`, item])).values()];
		setProgress(100, 'Analyse terminée');
		showResults({ date: new Date().toISOString(), vehicle: vehicleInfo(), codes: unique, demo: false });
	} catch (error) {
		modal('Le diagnostic a échoué', `<p>${escapeHTML(error.message || 'Une erreur est survenue.')}</p><p>Vérifiez le contact et la compatibilité ELM327. Un adaptateur qui ne répond plus doit être déconnecté puis reconnecté.</p>`, 'ERREUR DE LECTURE');
		try { await reader.cancel(); } catch { /* Flux série déjà fermé. */ }
		try { await serialPort.close(); } catch { /* Port série déjà fermé. */ }
		serialPort = null;
		connection(false, 'Adaptateur déconnecté');
	} finally {
		try { reader.releaseLock(); } catch { /* Flux fermé. */ }
		try { writer.releaseLock(); } catch { /* Flux fermé. */ }
		busy = false;
		$('#connect-button').disabled = false;
		$('#scan-button').disabled = !serialPort;
		setTimeout(() => { $('#scan-progress').hidden = true; }, 900);
	}
}

function runDemo() {
	if (busy) return;
	busy = true;
	$('#demo-button').disabled = true;
	$('#scan-button').disabled = true;
	const steps = [[18, 'Initialisation de la simulation…'], [45, 'Lecture des calculateurs…'], [72, 'Décodage des anomalies…'], [100, 'Simulation terminée']];
	steps.forEach(([percent, label], index) => setTimeout(() => {
		setProgress(percent, label);
		if (index === steps.length - 1) {
			showResults({ date: new Date().toISOString(), vehicle: vehicleInfo(), codes: DEMO_CODES, demo: true });
			busy = false;
			$('#demo-button').disabled = false;
			$('#scan-button').disabled = !serialPort;
			setTimeout(() => { $('#scan-progress').hidden = true; }, 900);
		}
	}, index * 430));
}

function saveReport() {
	if (!activeResult) return;
	const lines = ['AUTO SCAN — RAPPORT OBD-II', `Date : ${new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(activeResult.date))}`, `Véhicule : ${activeResult.vehicle.label}`, activeResult.vehicle.vin ? `VIN : ${activeResult.vehicle.vin}` : '', activeResult.demo ? 'Mode : simulation, données fictives' : 'Mode : lecture OBD-II', ''];
	for (const item of activeResult.codes) { const info = codeInfo(item.code); lines.push(`${item.code} — ${info.title} (${item.status})`, info.description, ''); }
	lines.push('Résultat indicatif à confirmer par un professionnel et la documentation constructeur.');
	const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' }));
	const link = document.createElement('a');
	link.href = url;
	link.download = `auto-scan-${activeResult.date.slice(0, 10)}.txt`;
	link.click();
	URL.revokeObjectURL(url);
}

function openDocumentDB() {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open('autoscan-documents', 1);
		request.onupgradeneeded = () => request.result.createObjectStore('files', { keyPath: 'id' });
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

async function storeDocument(file) {
	if (!file || file.size > 15 * 1024 * 1024) throw new Error('Le fichier doit faire moins de 15 Mo.');
	if (!/^(application\/pdf|image\/(jpeg|png|webp))$/.test(file.type)) throw new Error('Formats acceptés : PDF, JPG, PNG ou WebP.');
	const db = await openDocumentDB();
	const record = { id: crypto.randomUUID(), name: file.name, type: $('#document-type').value, mime: file.type, size: file.size, date: new Date().toISOString(), blob: file };
	await new Promise((resolve, reject) => {
		const transaction = db.transaction('files', 'readwrite');
		transaction.objectStore('files').add(record);
		transaction.oncomplete = resolve;
		transaction.onerror = () => reject(transaction.error);
	});
	documents.unshift({ id: record.id, name: record.name, type: record.type, mime: record.mime, size: record.size, date: record.date });
	localStorage.setItem(KEYS.docs, JSON.stringify(documents));
	db.close();
	renderDocuments();
}

function renderDocuments() {
	const list = $('#document-list');
	list.innerHTML = documents.length ? documents.map((doc) => `<div class="document-row"><span class="document-file-icon">${doc.mime === 'application/pdf' ? 'PDF' : 'IMG'}</span><div class="document-details"><strong>${escapeHTML(doc.name)}</strong><span>${escapeHTML(doc.type)} · ${new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short' }).format(new Date(doc.date))}</span></div><button class="icon-button document-open" data-id="${escapeHTML(doc.id)}" title="Ouvrir le document" aria-label="Ouvrir ${escapeHTML(doc.name)}">↗</button><button class="icon-button document-delete" data-id="${escapeHTML(doc.id)}" title="Supprimer le document" aria-label="Supprimer ${escapeHTML(doc.name)}">×</button></div>`).join('') : '<p class="documents-empty">Aucun document ajouté. Vos fichiers restent enregistrés dans ce navigateur.</p>';
	list.querySelectorAll('.document-open').forEach((button) => button.addEventListener('click', () => openDocument(button.dataset.id)));
	list.querySelectorAll('.document-delete').forEach((button) => button.addEventListener('click', () => deleteDocument(button.dataset.id)));
}

async function openDocument(id) {
	const db = await openDocumentDB();
	const record = await new Promise((resolve, reject) => {
		const request = db.transaction('files').objectStore('files').get(id);
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
	db.close();
	if (!record) return;
	const url = URL.createObjectURL(record.blob);
	window.open(url, '_blank', 'noopener');
	setTimeout(() => URL.revokeObjectURL(url), 60000);
}

async function deleteDocument(id) {
	const db = await openDocumentDB();
	await new Promise((resolve, reject) => {
		const transaction = db.transaction('files', 'readwrite');
		transaction.objectStore('files').delete(id);
		transaction.oncomplete = resolve;
		transaction.onerror = () => reject(transaction.error);
	});
	db.close();
	documents = documents.filter((doc) => doc.id !== id);
	localStorage.setItem(KEYS.docs, JSON.stringify(documents));
	renderDocuments();
}

function explainDocument() {
	const type = $('#document-type').value;
	const text = $('#document-text').value.trim();
	if (!text) {
		modal('Ajoutez le texte à expliquer', '<p>Copiez les lignes importantes du document dans la zone prévue. Les scans et photos ne sont pas encore lus automatiquement.</p>', 'AIDE DOCUMENT');
		return;
	}
	const lower = text.toLocaleLowerCase('fr');
	let title = 'Résumé de votre document';
	let advice = [];
	if (type === 'Contrôle technique') {
		title = /défavorable|contre.?visite|défaillance majeure|défaillance critique/.test(lower) ? 'Une contre-visite ou une réparation peut être nécessaire' : 'Résultat de contrôle technique';
		advice = ['Repérez le résultat global et la date limite indiquée sur le procès-verbal.', 'Une défaillance critique peut imposer une immobilisation ; vérifiez les délais et consignes inscrits sur le document.', 'Comparez les codes défaut OBD-II aux observations du contrôleur.'];
	} else if (type === 'Facture garage' || type === 'Devis garage') {
		title = type === 'Devis garage' ? 'Points à vérifier avant d’accepter le devis' : 'Résumé des travaux et du montant';
		advice = ['Séparez les pièces, la main-d’œuvre, les taux horaires et la TVA.', 'Vérifiez que l’immatriculation, le kilométrage et les travaux correspondent au véhicule.', 'Comparez le devis et la facture finale ; demandez une explication pour toute ligne imprévue.'];
	} else if (type === 'Carte grise') {
		title = 'Repères sur le certificat d’immatriculation';
		advice = ['B : première mise en circulation ; D.1 : marque ; D.3 : dénomination commerciale.', 'E : numéro VIN ; P.3 : énergie ; F.1/F.2 : masses maximales autorisées.', 'Ne partagez pas publiquement le VIN, l’immatriculation ou les coordonnées personnelles.'];
	} else if (type === 'Reçu garage') {
		title = 'Résumé du reçu';
		advice = ['Vérifiez la date, le garage, le montant payé et le mode de paiement.', 'Un reçu prouve un paiement, mais ne détaille pas toujours les travaux effectués.', 'Conservez-le avec la facture et l’ordre de réparation correspondants.'];
	} else {
		advice = ['Vérifiez l’émetteur, la date, le véhicule concerné et la période de validité.', 'Repérez les montants, échéances, réserves et actions qui vous sont demandées.', 'En cas de doute, demandez confirmation à l’organisme qui a émis le document.'];
	}
	const flags = [];
	if (/urgent|immobilisation|danger|critique/.test(lower)) flags.push('Le texte contient une mention de danger, d’urgence ou d’immobilisation : faites confirmer la conduite à tenir par un professionnel.');
	if (/contre.?visite|défaillance majeure/.test(lower)) flags.push('Une contre-visite ou une défaillance majeure est mentionnée : vérifiez l’échéance exacte sur l’original.');
	if (/impayé|retard de paiement|mise en demeure/.test(lower)) flags.push('Une mention de paiement ou de mise en demeure apparaît : contrôlez le montant et le délai indiqués.');
	$('#document-explanation').innerHTML = `<strong>${escapeHTML(title)}</strong><ul>${advice.map((item) => `<li>${escapeHTML(item)}</li>`).join('')}</ul>${flags.map((flag) => `<p class="document-alert">${escapeHTML(flag)}</p>`).join('')}<p class="explanation-note">Aide de lecture générale, basée sur le type choisi et les mots collés. Elle ne vérifie pas le document et ne remplace pas un professionnel ou l’organisme émetteur.</p>`;
	$('#document-explanation').hidden = false;
}

async function importCatalog(event) {
	try {
		const data = JSON.parse(await event.target.files[0].text());
		const entries = Array.isArray(data) ? data : data.codes;
		if (!Array.isArray(entries)) throw new Error('Le fichier doit contenir un tableau « codes ».');
		let added = 0;
		entries.forEach((item) => {
			const code = String(item.code || '').toUpperCase();
			if (/^[PCBU][0-3][0-9A-F]{3}$/.test(code) && typeof item.title === 'string' && typeof item.description === 'string') {
				catalog[code] = { title: item.title.slice(0, 120), description: item.description.slice(0, 1000) };
				added++;
			}
		});
		if (!added) throw new Error('Aucun code valide avec title et description.');
		localStorage.setItem(KEYS.catalog, JSON.stringify(catalog));
		$('#catalog-stat').textContent = `${catalogSize()} codes`;
		modal('Catalogue mis à jour', `<p>${added} code(s) ajouté(s) à cette installation.</p><p>Pour déployer les mises à jour à tous les clients, il faudra un catalogue hébergé et une API.</p>`, 'IMPORT TERMINÉ');
	} catch (error) {
		modal('Import impossible', `<p>${escapeHTML(error.message || 'Fichier JSON invalide.')}</p>`, 'CATALOGUE');
	} finally { event.target.value = ''; }
}

async function init() {
	if (!Array.isArray(history)) history = [];
	if (!Array.isArray(documents)) documents = [];
	$('#catalog-stat').textContent = `${catalogSize()} codes`;
	const savedVehicle = readStored(KEYS.vehicle, {});
	$('#vehicle-plate').value = savedVehicle.plate || '';
	$('#vehicle-make').value = savedVehicle.make || '';
	$('#vehicle-model').value = savedVehicle.model || '';
	$('#vehicle-vin').value = savedVehicle.vin || '';
	renderHistory();
	renderDocuments();
	connection(false, 'Adaptateur non connecté');
	$('#connect-button').addEventListener('click', connectAdapter);
	$('#scan-button').addEventListener('click', runScan);
	$('#demo-button').addEventListener('click', runDemo);
	$('#save-vehicle').addEventListener('click', () => {
		localStorage.setItem(KEYS.vehicle, JSON.stringify(vehicleInfo()));
		$('#vehicle-saved').textContent = 'Véhicule enregistré';
		setTimeout(() => { $('#vehicle-saved').textContent = ''; }, 1800);
	});
	$('#export-button').addEventListener('click', saveReport);
	$('#catalog-file').addEventListener('change', importCatalog);
	$('#document-file').addEventListener('change', async (event) => {
		try { await storeDocument(event.target.files[0]); }
		catch (error) { modal('Document non enregistré', `<p>${escapeHTML(error.message || 'Stockage local indisponible.')}</p>`, 'DOCUMENT'); }
		finally { event.target.value = ''; }
	});
	$('#explain-document').addEventListener('click', explainDocument);
	$('#clear-documents').addEventListener('click', async () => {
		if (!documents.length || !confirm('Supprimer tous les documents de cet appareil ?')) return;
		const db = await openDocumentDB();
		await new Promise((resolve) => { const transaction = db.transaction('files', 'readwrite'); transaction.objectStore('files').clear(); transaction.oncomplete = resolve; });
		db.close(); documents = []; localStorage.removeItem(KEYS.docs); renderDocuments();
	});
	$('#format-link').addEventListener('click', (event) => {
		event.preventDefault();
		modal('Format du catalogue JSON', '<pre>[\n  { "code": "P0420",\n    "title": "Rendement catalyseur faible",\n    "description": "Contrôler les sondes lambda." }\n]</pre>', 'IMPORT JSON');
	});
	$('#clear-history').addEventListener('click', () => {
		if (history.length && confirm('Effacer les diagnostics enregistrés sur cet appareil ?')) {
			history = []; localStorage.removeItem(KEYS.history); renderHistory();
		}
	});
	$('#reset-data').addEventListener('click', async () => {
		if (!confirm('Supprimer le véhicule, l’historique, les documents et le catalogue local ?')) return;
		try {
			await new Promise((resolve, reject) => {
				const request = indexedDB.deleteDatabase('autoscan-documents');
				request.onsuccess = resolve;
				request.onerror = () => reject(request.error);
				request.onblocked = () => reject(new Error('Fermez les autres onglets Auto Scan puis réessayez.'));
			});
			[...Object.values(KEYS), OPTIONS_KEY].forEach((key) => localStorage.removeItem(key));
			location.reload();
		} catch (error) {
			modal('Données non réinitialisées', `<p>${escapeHTML(error.message || 'Le stockage des documents est encore ouvert.')}</p>`, 'ERREUR DE SUPPRESSION');
		}
	});
	const optionFields = [['option-dark', 'darkMode'], ['option-pending', 'includePending'], ['option-permanent', 'includePermanent'], ['option-history', 'saveHistory']];
	const applyOptions = () => {
		document.body.classList.toggle('dark-theme', Boolean(options.darkMode));
		optionFields.forEach(([id, key]) => { $(`#${id}`).checked = Boolean(options[key]); });
		$('#option-baud').value = String(options.baudRate);
	};
	applyOptions();
	$('#settings-button').addEventListener('click', () => { applyOptions(); $('#settings-modal').showModal(); });
	optionFields.forEach(([id, key]) => $(`#${id}`).addEventListener('change', (event) => {
		options[key] = event.target.checked;
		localStorage.setItem(OPTIONS_KEY, JSON.stringify(options));
		applyOptions();
	}));
	$('#option-baud').addEventListener('change', (event) => {
		options.baudRate = Number(event.target.value);
		localStorage.setItem(OPTIONS_KEY, JSON.stringify(options));
	});
	$('#plans-button').addEventListener('click', () => modal('Offre de lancement', '<p>Proposition de départ : 9,90 € TTC/mois par atelier, avec période d’essai et tarif annuel réduit.</p><p>Cette maquette ne gère ni comptes ni paiements. Un serveur sécurisé et un prestataire de paiement sont nécessaires avant toute vente.</p>', 'ABONNEMENT'));
	$('#help-button').addEventListener('click', () => modal('Connexion et limites', '<ul><li>Adaptateur OBD-II USB ELM327 requis ; Chrome ou Edge sur ordinateur, en HTTPS ou localhost.</li><li>Les adaptateurs Bluetooth ne sont pas pris en charge par cette connexion série.</li><li>La lecture générique vise les codes moteur/antipollution : ABS, airbag, boîte et fonctions constructeur sont exclus.</li><li>Documents stockés dans ce navigateur. Il n’y a pas d’OCR automatique : collez les passages à expliquer.</li></ul>', 'AIDE'));
	$('.banner-close').addEventListener('click', () => { $('#connection-banner').hidden = true; });
	if ('serial' in navigator) navigator.serial.addEventListener('disconnect', () => { serialPort = null; connection(false, 'Adaptateur déconnecté'); });
}

init();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
	window.addEventListener('load', () => {
		navigator.serviceWorker.register('./service-worker.js').catch(() => {});
	});
}
