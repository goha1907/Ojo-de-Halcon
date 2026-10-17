-- The news that used to live in apps/web/content/news now live in the database (NewsPost), edited in the admin area.
-- Rows that already exist (same slug and language) are left alone, so running this twice or after edits changes nothing.

INSERT INTO "NewsPost" ("id", "slug", "locale", "date", "time", "title", "summary", "body", "image", "featured", "createdAt", "updatedAt") VALUES
  ($n$news_2026-10-13-in-development_en$n$, $n$2026-10-13-in-development$n$, $n$en$n$, $n$2026-10-13$n$, $n$09:00$n$, $n$Ojo de Halcón is in development — opening the doors soon$n$, $n$We are building a service that gathers your trackings in one place and tells you about changes. We expect our first users very soon.$n$, $n$**Ojo de Halcón** is a “hawk’s eye” for your documents. We are building a service that watches your DNI, citizenship and postal shipments for you and tells you in the bot when something changes. No more visiting different websites one by one and guessing what the latest status means.

The project is **in development** right now, but we are close and will soon be glad to welcome our first users.

## What is ready

- your account: sign-up, sign-in, profile;
- Telegram notifications for each tracking;
- automatic checking of five sources: Migraciones (DNI and citizenship), RENAPER, Correo Argentino and the court (PJN);
- a subscription based on the number of trackings;
- a “Useful links” section with links to the official sites;
- this news page: we will tell you everything important here.

## What is next

A WhatsApp bot, tracking of any postal shipments and a documents assistant. We will write about every launch here.

Thank you for being with us. Check the news: we are coming soon!$n$, $n$/news/in-development.svg$n$, false, now(), now()),
  ($n$news_2026-10-13-in-development_es$n$, $n$2026-10-13-in-development$n$, $n$es$n$, $n$2026-10-13$n$, $n$09:00$n$, $n$Ojo de Halcón está en desarrollo — pronto abrimos las puertas$n$, $n$Estamos creando un servicio que reúne tus seguimientos en un solo lugar y te avisa de los cambios. Esperamos a los primeros usuarios muy pronto.$n$, $n$**Ojo de Halcón** es el «ojo de halcón» de tus documentos. Estamos creando un servicio que sigue por ti el DNI, la ciudadanía y los envíos postales, y te avisa en el bot cuando algo cambia. Ya no habrá que entrar uno por uno a distintos sitios ni adivinar qué significa cada estado.

Por ahora el proyecto **está en desarrollo**, pero estamos cerca y muy pronto recibiremos con gusto a los primeros usuarios.

## Qué ya está listo

- cuenta personal: registro, ingreso, perfil;
- avisos por Telegram para cada seguimiento;
- consulta automática de cinco fuentes: Migraciones (DNI y ciudadanía), RENAPER, Correo Argentino y la justicia (PJN);
- suscripción según la cantidad de seguimientos;
- sección «Útil» con enlaces a los sitios oficiales;
- esta página de novedades, donde contaremos todo lo importante.

## Qué sigue

Bot de WhatsApp, seguimiento de cualquier envío postal y un asistente de documentos. Contaremos cada lanzamiento aquí.

¡Gracias por acompañarnos! Pasa por las novedades: ¡falta poco!$n$, $n$/news/in-development.svg$n$, false, now(), now()),
  ($n$news_2026-10-13-in-development_ru$n$, $n$2026-10-13-in-development$n$, $n$ru$n$, $n$2026-10-13$n$, $n$09:00$n$, $n$Ojo de Halcón в разработке — скоро открываем двери$n$, $n$Делаем сервис, который собирает ваши отслеживания в одном месте и сообщает об изменениях. Первых пользователей ждём совсем скоро.$n$, $n$**Ojo de Halcón** — «соколиный глаз» для ваших документов. Мы делаем сервис, который следит за DNI, гражданством и почтовыми отправлениями вместо вас и сообщает в бот, когда что-то меняется. Больше не нужно по очереди заходить на разные сайты и гадать, что означает очередной статус.

Сейчас проект **в разработке**, но мы уже близко и скоро будем рады приветствовать первых пользователей.

## Что уже готово

- личный кабинет: регистрация, вход, профиль;
- уведомления в Telegram по каждому отслеживанию;
- автоматическая проверка пяти источников: Migraciones (DNI и гражданство), RENAPER, Correo Argentino и суд (PJN);
- подписка по количеству отслеживаний;
- раздел «Полезное» со ссылками на официальные сайты;
- эта страница новостей — здесь мы будем рассказывать обо всём важном.

## Что дальше

Бот в WhatsApp, отслеживание любых почтовых отправлений и помощник по документам. О каждом запуске напишем здесь.

Спасибо, что с нами. Заглядывайте в новости — мы скоро!$n$, $n$/news/in-development.svg$n$, false, now(), now()),
  ($n$news_2026-10-13-roadmap_en$n$, $n$2026-10-13-roadmap$n$, $n$en$n$, $n$2026-10-13$n$, $n$18:00$n$, $n$What works now and what comes next$n$, $n$Which sources are connected and what we plan to add.$n$, $n$## Already connected

1. **DNI** — the resolution at Migraciones and production at RENAPER.
2. **Post** — tracking at Correo Argentino.
3. **Citizenship** — the status at Migraciones and the progress of the court case (PJN).

## Planned

**Documents assistant.** It will go through the documents of a citizenship case and explain in plain language what each document is, why it is needed and what is required from you. Coming soon.

**WhatsApp bot.** Notifications will arrive where it is more convenient for you. Coming soon.

**Postal shipments.** The Correo Argentino section will become a section for any parcels, not only for DNI. Coming soon.$n$, $n$/news/roadmap.svg$n$, false, now(), now()),
  ($n$news_2026-10-13-roadmap_es$n$, $n$2026-10-13-roadmap$n$, $n$es$n$, $n$2026-10-13$n$, $n$18:00$n$, $n$Qué ya funciona y qué sigue$n$, $n$Qué fuentes están conectadas y qué planeamos agregar.$n$, $n$## Ya conectado

1. **DNI** — resolución en Migraciones y producción en RENAPER.
2. **Correo** — seguimiento en Correo Argentino.
3. **Ciudadanía** — estado en Migraciones y avance de la causa en la justicia (PJN).

## En planes

**Asistente de documentos.** Leerá los documentos del expediente de ciudadanía y explicará en lenguaje simple qué es cada uno, para qué sirve y qué se espera de ti. Muy pronto.

**Bot de WhatsApp.** Los avisos llegarán donde te resulte más cómodo. Muy pronto.

**Envíos postales.** La sección de Correo Argentino será para cualquier paquete, no solo para el DNI. Muy pronto.$n$, $n$/news/roadmap.svg$n$, false, now(), now()),
  ($n$news_2026-10-13-roadmap_ru$n$, $n$2026-10-13-roadmap$n$, $n$ru$n$, $n$2026-10-13$n$, $n$18:00$n$, $n$Что уже работает и что дальше$n$, $n$Какие источники подключены и что мы планируем добавить.$n$, $n$## Уже подключено

1. **DNI** — резолюция в Migraciones и изготовление в RENAPER.
2. **Почта** — отслеживание в Correo Argentino.
3. **Гражданство** — статус в Migraciones и ход дела в суде (PJN).

## В планах

**Помощник по документам.** Разберёт документы из дела о гражданстве и простым языком объяснит, что это за документ, зачем он нужен и что требуется от вас. Скоро.

**Бот в WhatsApp.** Уведомления будут приходить туда, где вам удобнее. Скоро.

**Почтовые отправления.** Раздел Correo Argentino станет разделом для любых посылок, а не только для DNI. Скоро.$n$, $n$/news/roadmap.svg$n$, false, now(), now()),
  ($n$news_2026-10-14-all-sources_en$n$, $n$2026-10-14-all-sources$n$, $n$en$n$, $n$2026-10-14$n$, $n$10:00$n$, $n$All five sources are connected$n$, $n$Migraciones, RENAPER, Correo Argentino and the court are now checked automatically.$n$, $n$We have connected the last sources. Now in your account you can track:

- **DNI at Migraciones** — the resolution of the file. The number and the holder’s date of birth are needed;
- **citizenship at Migraciones** — the status by number and date of birth;
- **DNI at RENAPER** — the production stages, including the movement at the post office;
- **Correo Argentino** — a shipment by its number;
- **a citizenship court case (PJN)** — by court, number and year.

## How a tracking is added

First we read the source and show whose tracking it is. The stages appear only after you confirm. If the case is already finished, we will warn you: it will be kept in your history and will not take a slot in the subscription.

The same tracking cannot be added twice.$n$, $n$/news/all-sources.svg$n$, false, now(), now()),
  ($n$news_2026-10-14-all-sources_es$n$, $n$2026-10-14-all-sources$n$, $n$es$n$, $n$2026-10-14$n$, $n$10:00$n$, $n$Las cinco fuentes están conectadas$n$, $n$Migraciones, RENAPER, Correo Argentino y la justicia ya se consultan automáticamente.$n$, $n$Conectamos las últimas fuentes. Ahora en el panel puedes seguir:

- **DNI en Migraciones** — resolución del expediente. Hace falta el número y la fecha de nacimiento del titular;
- **ciudadanía en Migraciones** — estado por número y fecha de nacimiento;
- **DNI en RENAPER** — etapas de producción, incluido el movimiento postal;
- **Correo Argentino** — envío por número;
- **causa de ciudadanía en la justicia (PJN)** — por juzgado, número y año de la causa.

## Cómo se agrega un seguimiento

Primero leemos la fuente y te mostramos de quién es el seguimiento. Las etapas aparecen solo después de que confirmes. Si el caso ya finalizó, te avisamos: quedará en el historial y no ocupará un lugar de la suscripción.

El mismo seguimiento no se puede agregar dos veces.$n$, $n$/news/all-sources.svg$n$, false, now(), now()),
  ($n$news_2026-10-14-all-sources_ru$n$, $n$2026-10-14-all-sources$n$, $n$ru$n$, $n$2026-10-14$n$, $n$10:00$n$, $n$Все пять источников подключены$n$, $n$Migraciones, RENAPER, Correo Argentino и суд теперь проверяются автоматически.$n$, $n$Мы подключили последние источники. Теперь в кабинете можно отслеживать:

- **DNI в Migraciones** — резолюция по файлу. Нужен номер и дата рождения владельца;
- **гражданство в Migraciones** — статус по номеру и дате рождения;
- **DNI в RENAPER** — этапы изготовления, включая движение на почте;
- **Correo Argentino** — отправление по номеру;
- **дело о гражданстве в суде (PJN)** — по суду, номеру и году дела.

## Как добавляется отслеживание

Сначала мы читаем источник и показываем, чьё это отслеживание. Этапы появляются только после вашего подтверждения. Если дело уже завершено, мы предупредим: оно сохранится в истории и не займёт место в подписке.

Одно и то же отслеживание нельзя добавить дважды.$n$, $n$/news/all-sources.svg$n$, false, now(), now()),
  ($n$news_2026-10-14-cabinet_en$n$, $n$2026-10-14-cabinet$n$, $n$en$n$, $n$2026-10-14$n$, $n$15:00$n$, $n$Home page, notifications and status colours$n$, $n$What is new in your account: the home page, notification settings for each tracking, filters and colour marks.$n$, $n$## Home page

The home page now has a summary: how many trackings are active, how many are finished, what is waiting to be removed from the subscription and how many paid slots are free. Below is a table of your trackings: the latest status and the date of the change, the freshest first. If something needs attention (the subscription renews soon, Migraciones did not accept the details), you see it at once.

## Colours and filters

Every tracking has a colour mark on the left:

- **green** — tracked;
- **yellow** — waiting to be removed from the subscription;
- **red** — finished.

Every section has a filter by state and sorting by date, name and latest change.

## Notifications for each tracking

In “Settings → Notifications” you can choose where to send messages for each tracking. We no longer check finished trackings, and notifications for them switch off by themselves: they are shown in a separate table, “Finished trackings”.$n$, $n$/news/cabinet.svg$n$, false, now(), now()),
  ($n$news_2026-10-14-cabinet_es$n$, $n$2026-10-14-cabinet$n$, $n$es$n$, $n$2026-10-14$n$, $n$15:00$n$, $n$Inicio del panel, avisos y colores de estado$n$, $n$Novedades del panel: página de inicio, avisos por cada seguimiento, filtros y marcas de color.$n$, $n$## Inicio

El inicio ahora muestra un resumen: cuántos seguimientos hay activos, cuántos finalizados, cuáles esperan la baja de la suscripción y cuántos lugares pagados están libres. Debajo, la tabla de tus seguimientos: último estado y fecha del cambio, los más recientes arriba. Si algo requiere atención (la suscripción se renueva pronto, Migraciones no aceptó los datos), se ve enseguida.

## Colores y filtros

Cada seguimiento tiene una marca de color a la izquierda:

- **verde** — en seguimiento;
- **amarillo** — espera la baja de la suscripción;
- **rojo** — finalizado.

En cada sección hay un filtro por estado y orden por fecha, nombre y último cambio.

## Avisos por cada seguimiento

En «Ajustes → Avisos» eliges para cada seguimiento adónde llegan los mensajes. Los seguimientos finalizados ya no se consultan y sus avisos se desactivan solos: se ven aparte en la tabla «Seguimientos finalizados».$n$, $n$/news/cabinet.svg$n$, false, now(), now()),
  ($n$news_2026-10-14-cabinet_ru$n$, $n$2026-10-14-cabinet$n$, $n$ru$n$, $n$2026-10-14$n$, $n$15:00$n$, $n$Главная кабинета, уведомления и цвета статусов$n$, $n$Что нового в личном кабинете: главная страница, настройка уведомлений по каждому отслеживанию, фильтры и цветовые метки.$n$, $n$## Главная

На главной теперь сводка: сколько отслеживается, сколько завершено, что ожидает удаления из подписки и сколько оплаченных мест свободно. Ниже таблица ваших отслеживаний: последний статус и дата изменения, самые свежие сверху. Если что-то требует внимания (подписка скоро продлится, Migraciones не принял данные), это видно сразу.

## Цвета и фильтры

У каждого отслеживания слева цветная метка:

- **зелёная** — отслеживается;
- **жёлтая** — ожидает удаления из подписки;
- **красная** — завершено.

В каждом разделе есть фильтр по состоянию и сортировка по дате, названию и последнему изменению.

## Уведомления по каждому отслеживанию

В «Настройки → Уведомления» можно выбрать для каждого отслеживания, куда присылать сообщения. Завершённые отслеживания мы больше не проверяем, и уведомления по ним отключаются сами: они видны отдельной таблицей «Завершённые отслеживания».$n$, $n$/news/cabinet.svg$n$, false, now(), now()),
  ($n$news_2026-10-14-correo-shipments_en$n$, $n$2026-10-14-correo-shipments$n$, $n$en$n$, $n$2026-10-14$n$, $n$15:00$n$, $n$Tracking any Correo Argentino shipment$n$, $n$In the “Correo” section you can now add not only DNI but also parcels, letters and shipments from abroad.$n$, $n$In the **Correo Argentino** section, when you add a tracking you choose the **shipment type**, as on the post office site, and the form shows exactly the fields that type needs.

## Supported types

- (Plus) Argentina → Argentina and ordinary shipments within Argentina: a prefix and a number of 7–9 digits;
- Argentina → another country: a prefix and a number;
- another country → Argentina: a code of 13 characters, for example `AB123456789CD`;
- DNI and Pasaporte: a procedure number;
- Mercado Libre and e-commerce parcels: a shipment number.

Before adding, we check the number against the rules of the chosen type, and notifications arrive like for the other trackings: when a shipment gets a new movement.$n$, $n$/news/correo-shipments.svg$n$, false, now(), now()),
  ($n$news_2026-10-14-correo-shipments_es$n$, $n$2026-10-14-correo-shipments$n$, $n$es$n$, $n$2026-10-14$n$, $n$15:00$n$, $n$Seguimiento de cualquier envío de Correo Argentino$n$, $n$En la sección «Correo» ahora puedes agregar no solo el DNI, sino también paquetes, cartas y envíos del exterior.$n$, $n$En la sección **Correo Argentino**, al agregar un seguimiento eliges el **tipo de envío**, igual que en el sitio del correo, y el formulario muestra solo los campos que ese tipo necesita.

## Tipos admitidos

- (Plus) Origen Nacional - Destino Nacional y envíos nacionales: prefijo y número de 7 a 9 dígitos;
- Origen Nacional - Destino Internacional: prefijo y número;
- Origen Internacional - Destino Nacional: código de 13 caracteres, por ejemplo `AB123456789CD`;
- DNI y Pasaporte: número de trámite;
- Mercadolibre y paquetería e-commerce: número del envío.

Antes de agregar revisamos el número con las reglas del tipo elegido, y los avisos llegan igual que en el resto de los seguimientos: cuando el envío tiene un movimiento nuevo.$n$, $n$/news/correo-shipments.svg$n$, false, now(), now()),
  ($n$news_2026-10-14-correo-shipments_ru$n$, $n$2026-10-14-correo-shipments$n$, $n$ru$n$, $n$2026-10-14$n$, $n$15:00$n$, $n$Отслеживание любых отправлений Correo Argentino$n$, $n$В разделе «Correo» теперь можно добавить не только DNI, но и посылки, письма и отправления из-за границы.$n$, $n$В разделе **Correo Argentino** при добавлении отслеживания вы выбираете **тип отправления**, как на сайте почты, и форма показывает именно те поля, которые нужны для него.

## Какие типы поддерживаются

- (Plus) Аргентина → Аргентина и обычные отправления по Аргентине: префикс и номер из 7–9 цифр;
- Аргентина → другая страна: префикс и номер;
- другая страна → Аргентина: код из 13 символов, например `AB123456789CD`;
- DNI и Pasaporte: номер трамита;
- Mercado Libre и посылки e-commerce: номер отправления.

Перед добавлением мы проверяем номер по правилам выбранного типа, а уведомления приходят так же, как и по остальным отслеживаниям: когда у отправления появляется новое движение.$n$, $n$/news/correo-shipments.svg$n$, false, now(), now()),
  ($n$news_2026-10-14-subscription_en$n$, $n$2026-10-14-subscription$n$, $n$en$n$, $n$2026-10-14$n$, $n$12:00$n$, $n$Subscription by trackings$n$, $n$Pay only for what you track and add trackings at any moment.$n$, $n$We made a subscription that is counted **by the number of trackings**, not by sections or people. Choose how many you need: they can all be in one section or in different ones.

## How it works

- the more trackings, the lower the price for each: the prices are on the home page, with a calculator;
- you can buy more trackings at any moment: they are paid right away and the renewal date does not change;
- a tracking can be removed from the subscription: it works until the end of the paid period and stays in your history, and the amount for the next period goes down;
- when a case is finished, its slot in the subscription is freed automatically and we write to you about it;
- you can cancel the whole subscription, everything keeps working until the end of the period.

In your account, in the “Subscription” section, you can see how many slots are paid, how many are in use, how many are free, the amount for the period and the estimated amount for the next one.$n$, $n$/news/subscription.svg$n$, false, now(), now()),
  ($n$news_2026-10-14-subscription_es$n$, $n$2026-10-14-subscription$n$, $n$es$n$, $n$2026-10-14$n$, $n$12:00$n$, $n$Suscripción por seguimientos$n$, $n$Pagas solo por lo que sigues y puedes agregar seguimientos cuando quieras.$n$, $n$Hicimos una suscripción que se calcula **por cantidad de seguimientos**, no por secciones ni por personas. Elige cuántos necesitas: pueden estar todos en una sección o en varias.

## Cómo funciona

- cuantos más seguimientos, menor el precio por cada uno: los precios están en la página principal, con una calculadora;
- puedes agregar más en cualquier momento: se pagan al instante y la fecha de renovación no cambia;
- un seguimiento se puede quitar de la suscripción: sigue hasta el fin del período pagado y queda en el historial, y el importe del próximo período baja;
- cuando un caso finaliza, el lugar de la suscripción se libera solo y te avisamos;
- puedes cancelar toda la suscripción: todo sigue funcionando hasta el fin del período.

En el panel, en «Suscripción», ves cuántos lugares están pagados, cuántos en uso y cuántos libres, el importe del período y la estimación del siguiente.$n$, $n$/news/subscription.svg$n$, false, now(), now()),
  ($n$news_2026-10-14-subscription_ru$n$, $n$2026-10-14-subscription$n$, $n$ru$n$, $n$2026-10-14$n$, $n$12:00$n$, $n$Подписка по отслеживаниям$n$, $n$Платите только за то, что отслеживаете, и добавляйте отслеживания в любой момент.$n$, $n$Мы сделали подписку, которая считается **по количеству отслеживаний**, а не по разделам или людям. Выбирайте сколько нужно: все могут быть в одном разделе или в разных.

## Как это устроено

- чем больше отслеживаний, тем ниже цена за одно: цены на главной странице, там же калькулятор;
- докупить отслеживания можно в любой момент: они оплачиваются сразу, а дата продления не меняется;
- отслеживание можно убрать из подписки: оно работает до конца оплаченного периода и остаётся в истории, а сумма следующего периода уменьшается;
- когда дело завершилось, место в подписке освобождается автоматически, и мы пишем вам об этом;
- подписку можно отменить целиком, всё продолжит работать до конца периода.

В кабинете, в разделе «Подписка», видно, сколько мест оплачено, сколько занято, сколько свободно, сумму за период и предварительную сумму на следующий.$n$, $n$/news/subscription.svg$n$, false, now(), now()),
  ($n$news_2026-10-16-new-look_en$n$, $n$2026-10-16-new-look$n$, $n$en$n$, $n$2026-10-16$n$, $n$18:00$n$, $n$A new look and a dark theme$n$, $n$We updated the design of the site and your account and added a theme switch: light, dark or like the system.$n$, $n$We updated the design: the site and your account now share one style, and the corners and buttons got softer.

## What is new

- **Colour theme.** A switch with three options: “Light”, “Dark” and “Like the system”. It is in the header of the home page and at the bottom of the account menu. Your choice is remembered in the browser.
- **Home page.** A live example of a tracking card in which the status changes before your eyes, a running line of sources and a section about what the status colours mean.
- **Animations.** They are soft and switch off by themselves if “reduce motion” is on in your system.

Everything works as before: only the look changes.$n$, $n$/news/new-look.svg$n$, false, now(), now()),
  ($n$news_2026-10-16-new-look_es$n$, $n$2026-10-16-new-look$n$, $n$es$n$, $n$2026-10-16$n$, $n$18:00$n$, $n$Nuevo aspecto y tema oscuro$n$, $n$Renovamos el diseño del sitio y del panel y añadimos la elección de tema: claro, oscuro o el del sistema.$n$, $n$Renovamos el diseño: ahora el sitio y el panel comparten un mismo estilo, con esquinas y botones más suaves.

## Qué hay de nuevo

- **Tema de color.** Un selector con tres opciones: «Claro», «Oscuro» y «Del sistema». Está en el encabezado de la página principal y en la parte inferior del menú del panel. La elección se recuerda en el navegador.
- **Página principal.** Un ejemplo vivo de la tarjeta de seguimiento donde el estado cambia a la vista, una franja con las fuentes y una sección sobre lo que significan los colores de los estados.
- **Animaciones.** Son suaves y se desactivan solas si el sistema tiene activado el modo «menos movimiento».

Todo funciona igual que antes: solo cambia el aspecto.$n$, $n$/news/new-look.svg$n$, false, now(), now()),
  ($n$news_2026-10-16-new-look_ru$n$, $n$2026-10-16-new-look$n$, $n$ru$n$, $n$2026-10-16$n$, $n$18:00$n$, $n$Новый вид и тёмная тема$n$, $n$Обновили оформление сайта и кабинета и добавили выбор темы: светлая, тёмная или как в системе.$n$, $n$Мы обновили оформление: теперь у сайта и кабинета единый стиль, а углы и кнопки стали мягче.

## Что нового

- **Тема оформления.** Переключатель с тремя вариантами: «Светлая», «Тёмная» и «Как в системе». Он есть в шапке главной страницы и в нижней части меню кабинета. Выбор запоминается в браузере.
- **Главная страница.** Живой пример карточки отслеживания, в котором статус меняется на глазах, бегущая строка источников и раздел о том, что означают цвета статусов.
- **Анимации.** Они мягкие и отключаются сами, если в системе включён режим «меньше движения».

Всё работает так же, как раньше: меняется только внешний вид.$n$, $n$/news/new-look.svg$n$, false, now(), now()),
  ($n$news_2026-10-17-languages_en$n$, $n$2026-10-17-languages$n$, $n$en$n$, $n$2026-10-17$n$, $n$12:00$n$, $n$The site in Russian, Spanish and English$n$, $n$The interface, e-mails and the bot now work in three languages, and you choose the language in the header.$n$, $n$Ojo de Halcón now speaks **three languages**: Russian, Spanish and English.

## What is new

- **The language switch** is in the header of the home page, in the footer and on the sign-in pages. Your choice is remembered.
- **E-mails and the bot** use the same language you chose in your account.
- **The news** is also translated into all three languages.

If you notice an inaccuracy in a translation, write to us through the contact form.$n$, $n$/news/languages.svg$n$, false, now(), now()),
  ($n$news_2026-10-17-languages_es$n$, $n$2026-10-17-languages$n$, $n$es$n$, $n$2026-10-17$n$, $n$12:00$n$, $n$El sitio en ruso, español e inglés$n$, $n$Ahora la interfaz, los correos y el bot funcionan en tres idiomas, y el idioma se elige en el encabezado.$n$, $n$Ojo de Halcón ahora habla **tres idiomas**: ruso, español e inglés.

## Qué hay de nuevo

- **El selector de idioma** está en el encabezado de la página principal, en el pie y en las páginas de acceso. La elección se recuerda.
- **Los correos y el bot** usan el mismo idioma que elegiste en tu cuenta.
- **Las novedades** también están traducidas a los tres idiomas.

Si notas una imprecisión en la traducción, escríbenos por el formulario de contacto.$n$, $n$/news/languages.svg$n$, false, now(), now()),
  ($n$news_2026-10-17-languages_ru$n$, $n$2026-10-17-languages$n$, $n$ru$n$, $n$2026-10-17$n$, $n$12:00$n$, $n$Сайт на русском, испанском и английском$n$, $n$Теперь интерфейс, письма и бот работают на трёх языках, язык выбирается в шапке.$n$, $n$Ojo de Halcón теперь говорит на **трёх языках**: русском, испанском и английском.

## Что нового

- **Переключатель языка** есть в шапке главной страницы, в подвале и на страницах входа. Выбор запоминается.
- **Письма и бот** используют тот же язык, что выбран в вашем аккаунте.
- **Новости** тоже переведены на все три языка.

Если вы заметите неточность в переводе, напишите нам через форму обратной связи.$n$, $n$/news/languages.svg$n$, false, now(), now())
ON CONFLICT ("slug", "locale") DO NOTHING;
