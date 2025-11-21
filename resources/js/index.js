import {driver} from "driver.js";
import {initCssSelector} from './css-selector.js';

// Guard to avoid re-registering listeners on every Livewire navigation
let listenersRegistered = false;

// Shared state across navigations; reset per navigation
let pluginData = null;
let tours = [];
let highlights = [];

async function handleEvent() {

    // Ensure CSS selector helpers are initialized on each navigation
    initCssSelector();

    // Reset state for the current page
    pluginData = null;
    tours = [];
    highlights = [];

    function waitForElement(selector, callback) {
        if (document.querySelector(selector)) {
            callback(document.querySelector(selector));
            return;
        }

        const observer = new MutationObserver(function (mutations) {
            if (document.querySelector(selector)) {
                callback(document.querySelector(selector));
                observer.disconnect();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    function parseId(params) {

        if (Array.isArray(params)) {
            return params[0];
        } else if (typeof params === 'object') {
            return params.id;
        }

        return params;
    }

    // Request fresh data for the current route
    Livewire.dispatch('filament-tour::load-elements', {request: window.location});

    // Register Livewire event listeners only once to prevent duplicated handlers
    if (!listenersRegistered) {
        listenersRegistered = true;

        Livewire.on('filament-tour::loaded-elements', function (data) {

            pluginData = data;

            // Initialize localStorage structure once
            if (!localStorage.getItem('tours')) {
                localStorage.setItem('tours', "[]");
            }

            pluginData.tours.forEach((tour) => {
                // Avoid duplicate push across navigations by checking id
                if (!tours.find(t => t.id === tour.id)) {
                    tours.push(tour);
                }
            });

            selectTour(tours);

            pluginData.highlights.forEach((highlight) => {

                if (highlight.route === window.location.pathname) {

                    //TODO Add a more precise/efficient selector

                    waitForElement(highlight.parent, function (selector) {
                        // Ensure parent is positionable
                        if (selector.parentNode && selector.parentNode.style) {
                            selector.parentNode.style.position = selector.parentNode.style.position || 'relative';
                        }

                        // Avoid inserting duplicate buttons by using a data attribute marker
                        let tempDiv = document.createElement('div');
                        tempDiv.innerHTML = highlight.button;

                        const buttonEl = tempDiv.firstChild;
                        if (!buttonEl) {
                            return;
                        }

                        buttonEl.classList.add(highlight.position);
                        buttonEl.setAttribute('data-filament-tour-highlight-id', String(highlight.id));

                        const alreadyInserted = selector.parentNode && selector.parentNode.querySelector(
                            `[data-filament-tour-highlight-id="${String(highlight.id)}"]`
                        );

                        if (!alreadyInserted && selector.parentNode) {
                            selector.parentNode.insertBefore(buttonEl, selector);
                        }
                    });

                    if (!highlights.find(h => h.id === highlight.id)) {
                        highlights.push(highlight);
                    }
                }
            });
        });

        Livewire.on('filament-tour::open-highlight', function (params) {

            const id = parseId(params);

            let highlight = highlights.find(element => element.id === id);

            if (highlight) {
                driver({
                    overlayColor: localStorage.theme === 'light' ? highlight.colors.light : highlight.colors.dark,

                    onPopoverRender: (popover, {config, state}) => {
                        popover.title.innerHTML = "";
                        popover.title.innerHTML = state.activeStep.popover.title;

                        if (!state.activeStep.popover.description) {
                            popover.title.firstChild.style.justifyContent = 'center';
                        }

                        let contentClasses = "dark:text-white fi-section rounded-xl bg-white shadow-sm ring-1 ring-gray-950/5 dark:bg-gray-900 dark:ring-white/10 mb-4";

                        popover.footer.parentElement.classList.add(...contentClasses.split(" "));
                    },
                }).highlight(highlight);

            } else {
                console.error(`Highlight with id '${id}' not found`);
            }
        });

        Livewire.on('filament-tour::open-tour', function (params) {

            const id = parseId(params);

            let tour = tours.find(element => element.id === `tour_${id}`);

            if (tour) {
                openTour(tour);
            } else {
                console.error(`Tour with id '${id}' not found`);
            }
        });
    }

    function selectTour(tours, startIndex = 0) {
        for (let i = startIndex; i < tours.length; i++) {
            let tour = tours[i];
            let conditionAlwaysShow = tour.alwaysShow;
            let conditionRoutesIgnored = tour.routesIgnored;
            let conditionRouteMatches = tour.route === window.location.pathname;
            let conditionVisibleOnce = !pluginData.only_visible_once ||
                (pluginData.only_visible_once && !localStorage.getItem('tours').includes(tour.id));

            if (
                (conditionAlwaysShow && conditionRoutesIgnored) ||
                (conditionAlwaysShow && !conditionRoutesIgnored && conditionRouteMatches) ||
                (conditionRoutesIgnored && conditionVisibleOnce) ||
                (conditionRouteMatches && conditionVisibleOnce)
            ) {
                openTour(tour);
                break;
            }
        }
    }


    Livewire.on('filament-tour::open-highlight', function (params) {

        const id = parseId(params);

        console.log(highlights)

        let highlight = highlights.find(element => element.id === id);

        if (highlight) {
            driver({
                overlayColor: localStorage.theme === 'light' ? highlight.colors.light : highlight.colors.dark,

                onPopoverRender: (popover, {config, state}) => {
                    popover.title.innerHTML = "";
                    popover.title.innerHTML = state.activeStep.popover.title;

                    if (!state.activeStep.popover.description) {
                        popover.title.firstChild.style.justifyContent = 'center';
                    }

                    let contentClasses = "dark:text-white fi-section rounded-xl bg-white shadow-sm ring-1 ring-gray-950/5 dark:bg-gray-900 dark:ring-white/10 mb-4";

                    popover.footer.parentElement.classList.add(...contentClasses.split(" "));
                },
            }).highlight(highlight);

        } else {
            console.error(`Highlight with id '${id}' not found`);
        }
    });

    Livewire.on('filament-tour::open-tour', function (params) {

        const id = parseId(params);

        let tour = tours.find(element => element.id === `tour_${id}`);

        if (tour) {
            openTour(tour);
        } else {
            console.error(`Tour with id '${id}' not found`);
        }
    });

    function openTour(tour) {

        let steps = JSON.parse(tour.steps);

        if (steps.length > 0) {

            const driverObj = driver({
                allowClose: true,
                disableActiveInteraction: true,
                overlayColor: localStorage.theme === 'light' ? tour.colors.light : tour.colors.dark,
                onDeselected: ((element, step, {config, state}) => {

                }),
                onCloseClick: ((element, step, {config, state}) => {
                    if (state.activeStep && (!state.activeStep.uncloseable || tour.uncloseable))
                        driverObj.destroy();

                    if (!localStorage.getItem('tours').includes(tour.id)) {
                        localStorage.setItem('tours', JSON.stringify([...JSON.parse(localStorage.getItem('tours')), tour.id]));
                    }
                }),
                onDestroyStarted: ((element, step, {config, state}) => {
                    if (state.activeStep && !state.activeStep.uncloseable && !tour.uncloseable) {
                        driverObj.destroy();
                    }
                }),
                onDestroyed: ((element, step, {config, state}) => {

                }),
                onNextClick: ((element, step, {config, state}) => {


                    if (tours.length > 1 && driverObj.isLastStep()) {
                        let index = tours.findIndex(objet => objet.id === tour.id);

                        if (index !== -1 && index < tours.length - 1) {
                            let nextTourIndex = index + 1;
                            selectTour(tours, nextTourIndex);
                        }
                    }


                    if (driverObj.isLastStep()) {

                        if (!localStorage.getItem('tours').includes(tour.id)) {
                            localStorage.setItem('tours', JSON.stringify([...JSON.parse(localStorage.getItem('tours')), tour.id]));
                        }

                        driverObj.destroy();
                    }


                    if (step.events) {

                        if (step.events.notifyOnNext) {
                            new FilamentNotification()
                                .title(step.events.notifyOnNext.title)
                                .body(step.events.notifyOnNext.body)
                                .icon(step.events.notifyOnNext.icon)
                                .iconColor(step.events.notifyOnNext.iconColor)
                                .color(step.events.notifyOnNext.color)
                                .duration(step.events.notifyOnNext.duration)
                                .send();
                        }

                        if (step.events.dispatchOnNext) {
                            Livewire.dispatch(step.events.dispatchOnNext.name, step.events.dispatchOnNext.params);
                        }

                        if (step.events.clickOnNext) {
                            document.querySelector(step.events.clickOnNext).click();
                        }

                        if (step.events.redirectOnNext) {
                            window.open(step.events.redirectOnNext.url, step.events.redirectOnNext.newTab ? '_blank' : '_self');
                        }
                    }


                    driverObj.moveNext();
                }),

                onPrevClick: ((element, step, {config, state}) => {
                    if (tours.length > 1 && driverObj.isFirstStep()) {
                        let index = tours.findIndex(objet => objet.id === tour.id);

                        if (index !== -1 && index > 0) {
                            let prevTourIndex = index - 1;
                            selectTour(tours, prevTourIndex);
                        }
                    }


                    // if (driverObj.isFirstStep()) {
                    //
                    //     // if (!localStorage.getItem('tours').includes(tour.id)) {
                    //     //     localStorage.setItem('tours', JSON.stringify([...JSON.parse(localStorage.getItem('tours')), tour.id]));
                    //     // }
                    //
                    //     driverObj.destroy();
                    // }


                    if (step.events) {
                        if (step.events.notifyOnNext) {
                            new FilamentNotification()
                                .title(step.events.notifyOnNext.title)
                                .body(step.events.notifyOnNext.body)
                                .icon(step.events.notifyOnNext.icon)
                                .iconColor(step.events.notifyOnNext.iconColor)
                                .color(step.events.notifyOnNext.color)
                                .duration(step.events.notifyOnNext.duration)
                                .send();
                        }

                        if (step.events.dispatchOnPrev) {
                            Livewire.dispatch(step.events.dispatchOnPrev.name, step.events.dispatchOnPrev.params);
                        }

                        if (step.events.clickOnPrev) {
                            document.querySelector(step.events.clickOnPrev).click();
                        }

                        if (step.events.redirectOnPrev) {
                            window.open(step.events.redirectOnPrev.url, step.events.redirectOnPrev.newTab ? '_blank' : '_self');
                        }
                    }


                    driverObj.movePrevious();
                }),

                onPopoverRender: (popover, {config, state}) => {

                    if (state.activeStep.uncloseable || tour.uncloseable)
                        document.querySelector(".driver-popover-close-btn").remove();

                    popover.title.innerHTML = "";
                    popover.title.innerHTML = state.activeStep.popover.title;

                    if (!state.activeStep.popover.description) {
                        popover.title.firstChild.style.justifyContent = 'center';
                    }

                    let contentClasses = "dark:text-white fi-section rounded-xl bg-white shadow-sm ring-1 ring-gray-950/5 dark:bg-gray-900 dark:ring-white/10 mb-4";

                    // popover.description.insertAdjacentHTML("beforeend", state.activeStep.popover.form);

                    popover.footer.parentElement.classList.add(...contentClasses.split(" "));

                    popover.footer.innerHTML = "";
                    popover.footer.classList.add('flex', 'mt-3');
                    popover.footer.style.justifyContent = 'space-evenly';

                    popover.footer.classList.remove("driver-popover-footer");


                    const nextButton = document.createElement("button");
                    // let nextClasses = "fi-btn fi-size-md relative grid-flow-col items-center justify-center font-semibold outline-none transition duration-75 focus:ring-2 disabled:pointer-events-none disabled:opacity-70 rounded-lg fi-color-primary gap-1.5 px-3 py-2 text-sm inline-grid shadow-sm bg-custom-600 text-white hover:bg-custom-500 dark:bg-custom-500 dark:hover:bg-custom-400 focus:ring-custom-500/50 dark:focus:ring-custom-400/50 fi-ac-btn-action";
                    let nextClasses = "fi-color fi-color-primary fi-bg-color-400 hover:fi-bg-color-300 dark:fi-bg-color-600 dark:hover:fi-bg-color-700 fi-text-color-900 hover:fi-text-color-800 dark:fi-text-color-0 dark:hover:fi-text-color-0 fi-btn fi-size-md fi-ac-btn-action relative grid-flow-col items-center justify-center disabled:pointer-events-none gap-1.5 px-3 py-2 inline-grid";

                    nextButton.classList.add(...nextClasses.split(" "), 'driver-popover-next-btn');
                    nextButton.innerText = driverObj.isLastStep() ? tour.doneButtonLabel : tour.nextButtonLabel;

                    // nextButton.style.setProperty('--c-400', 'var(--primary-400');
                    // nextButton.style.setProperty('--c-500', 'var(--primary-500');
                    // nextButton.style.setProperty('--c-600', 'var(--primary-600');

                    const prevButton = document.createElement("button");
                    // let prevClasses = "fi-btn fi-btn-size-md relative grid-flow-col items-center justify-center font-semibold outline-none transition duration-75 focus:ring-2 disabled:pointer-events-none disabled:opacity-70 rounded-lg fi-btn-color-gray gap-1.5 px-3 py-2 text-sm inline-grid shadow-sm bg-white text-gray-950 hover:bg-gray-50 dark:bg-white/5 dark:text-white dark:hover:bg-white/10 ring-1 ring-gray-950/10 dark:ring-white/20 fi-ac-btn-action";
                    let prevClasses = "fi-color fi-color-primary fi-bg-color-400 hover:fi-bg-color-300 dark:fi-bg-color-600 dark:hover:fi-bg-color-700 fi-text-color-900 hover:fi-text-color-800 dark:fi-text-color-0 dark:hover:fi-text-color-0 fi-btn fi-size-md fi-ac-btn-action relative grid-flow-col items-center justify-center disabled:pointer-events-none gap-1.5 px-3 py-2 inline-grid";
                    prevButton.classList.add(...prevClasses.split(" "), 'driver-popover-prev-btn');
                    prevButton.innerText = tour.previousButtonLabel;

                    if (!driverObj.isFirstStep()) {
                        popover.footer.appendChild(prevButton);
                    }
                    popover.footer.appendChild(nextButton);
                },
                steps: steps,
            });

            driverObj.drive();
        }
    }
}

document.addEventListener('livewire:navigated', handleEvent);
