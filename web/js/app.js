'use strict';

const $ = s => document.querySelector(s);

async function api(ruta, opts = {}) {
  const r = await fetch(ruta, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || 'No se ha podido completar.');
  return data;
}

function mostrar(usuario) {
  $('#login').classList.add('hide');
  $('#app').classList.remove('hide');
  $('#meNom').textContent = usuario.nombre;
  $('#meRol').textContent = usuario.rol === 'admin' ? 'Administrador' : 'Usuario';
  $('#avatar').textContent = usuario.iniciales;
  cargarResumen(usuario);
}

function mostrarLogin() {
  $('#app').classList.add('hide');
  $('#login').classList.remove('hide');
}

async function cargarResumen(usuario) {
  try {
    const [salud, proyectos, entradas, tareas] = await Promise.all([
      api('/api/salud'),
      api('/api/proyectos'),
      api('/api/entradas?desde=0'),
      api('/api/tareas')
    ]);
    $('#tiles').innerHTML = [
      tile('Proyectos', proyectos.proyectos.length, 'Cartera en la base de datos'),
      tile('Registros', entradas.entradas.length, usuario.rol === 'admin' ? 'Horas de todo el equipo' : 'Solo las tuyas'),
      tile('Escenas', tareas.escenas.length, 'Módulo de producción')
    ].join('');
    if (salud.semilla_recien) {
      $('#banner').textContent = 'Primera arrancada: se han creado las cuentas de ejemplo. Cambia las contraseñas antes de llevar esto al NAS.';
    }
  } catch (err) {
    $('#tiles').innerHTML = `<div class="card"><p class="cap">${esc(err.message)}</p></div>`;
  }
}

function tile(titulo, valor, cap) {
  return `<div class="card"><h2>${esc(titulo)}</h2><p class="cap">${esc(cap)}</p><div class="tile-value">${valor}</div></div>`;
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function errLogin(m) {
  const e = $('#loginErr');
  e.textContent = m;
  e.classList.remove('hide');
}

$('#loginForm').addEventListener('submit', async ev => {
  ev.preventDefault();
  $('#loginErr').classList.add('hide');
  try {
    const data = await api('/api/acceso/entrar', {
      method: 'POST',
      body: JSON.stringify({ usuario: $('#u').value, clave: $('#p').value })
    });
    if (data.necesita_mfa || data.necesita_alta_mfa) {
      errLogin('Esta cuenta tiene (o exige) doble factor. El alta del 2FA en esta pantalla llega en el siguiente paso; de momento entra con una cuenta sin 2FA, como alvaro / 1234.');
      return;
    }
    mostrar(data.usuario);
  } catch (err) {
    errLogin(err.message);
  }
});

$('#btnSalir').addEventListener('click', async () => {
  await api('/api/acceso/salir', { method: 'POST', body: '{}' });
  mostrarLogin();
});

['alvaro', 'jesus'].forEach(u => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'btn btn-sm';
  b.textContent = u;
  b.addEventListener('click', () => {
    $('#u').value = u;
    $('#p').value = '1234';
  });
  $('#quicks').appendChild(b);
});

api('/api/acceso/sesion').then(d => {
  if (d.usuario) mostrar(d.usuario);
}).catch(() => {});
