(function (window, document, $, moment) {
    'use strict';

    if (!$) {
        return;
    }

    var UZ_DATE_LOCALE = {
        days: ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'],
        daysShort: ['Yak', 'Dush', 'Sesh', 'Chor', 'Pay', 'Juma', 'Shan'],
        daysMin: ['Ya', 'Du', 'Se', 'Cho', 'Pa', 'Ju', 'Sha'],
        months: ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'],
        monthsShort: ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyn', 'Iyl', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'],
        today: 'Bugun',
        clear: 'Tozalash',
        format: 'yyyy-mm-dd',
        titleFormat: 'MM yyyy',
        weekStart: 1
    };

    $.fn.datepicker.dates.uz = UZ_DATE_LOCALE;

    if (moment) {
        moment.defineLocale('uz-lms', {
            months: UZ_DATE_LOCALE.months,
            monthsShort: UZ_DATE_LOCALE.monthsShort,
            weekdays: UZ_DATE_LOCALE.days,
            weekdaysShort: UZ_DATE_LOCALE.daysShort,
            weekdaysMin: UZ_DATE_LOCALE.daysMin,
            longDateFormat: {
                LT: 'HH:mm',
                L: 'YYYY-MM-DD',
                LL: 'D MMMM YYYY',
                LLL: 'D MMMM YYYY, HH:mm',
                LLLL: 'dddd, D MMMM YYYY, HH:mm'
            },
            week: {
                dow: 1,
                doy: 7
            }
        });
    }

    function previewTarget(input) {
        var selector = input.getAttribute('data-preview-target');
        return selector ? document.querySelector(selector) : null;
    }

    function formatDate(value, emptyText) {
        if (!value) {
            return emptyText || 'Sana tanlanmagan';
        }

        var parts = value.split('-');
        if (parts.length !== 3) {
            return value;
        }

        var date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        return new Intl.DateTimeFormat('uz-UZ', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        }).format(date);
    }

    function formatDateTime(value, emptyText) {
        if (!value) {
            return emptyText || 'Sana tanlanmagan';
        }

        if (moment) {
            var parsed = moment(value, ['YYYY-MM-DD HH:mm', moment.ISO_8601], true);
            if (parsed.isValid()) {
                return parsed.locale('uz-lms').format('D MMMM YYYY, HH:mm');
            }
        }

        return value;
    }

    function updatePreview(input) {
        var target = previewTarget(input);
        if (!target) {
            return;
        }

        var emptyText = input.getAttribute('data-preview-empty') || 'Sana tanlanmagan';
        if (input.hasAttribute('data-uz-datetimepicker')) {
            target.textContent = formatDateTime(input.value, emptyText);
            return;
        }

        target.textContent = formatDate(input.value, emptyText);
    }

    function syncDateTimeRange(input, value) {
        var pairSelector = input.getAttribute('data-linked-picker');
        var role = input.getAttribute('data-link-role');
        if (!pairSelector || !role) {
            return;
        }

        var $pair = $(pairSelector);
        var picker = $pair.data('DateTimePicker');
        if (!picker) {
            return;
        }

        if (role === 'start') {
            picker.minDate(value || false);
        } else if (role === 'end') {
            picker.maxDate(value || false);
        }
    }

    function initDatePicker(input) {
        var $input = $(input);
        if ($input.data('uzCalendarReady')) {
            updatePreview(input);
            return;
        }

        $input.datepicker({
            format: 'yyyy-mm-dd',
            language: 'uz',
            autoclose: true,
            todayHighlight: true,
            todayBtn: 'linked',
            clearBtn: true,
            weekStart: 1,
            orientation: 'bottom auto'
        }).on('changeDate clearDate', function () {
            updatePreview(input);
        }).on('change input', function () {
            updatePreview(input);
        });

        $input.data('uzCalendarReady', true);
        updatePreview(input);
    }

    function initDateTimePicker(input) {
        var $input = $(input);
        if ($input.data('uzCalendarReady')) {
            updatePreview(input);
            return;
        }

        $input.datetimepicker({
            format: 'YYYY-MM-DD HH:mm',
            locale: 'uz-lms',
            sideBySide: true,
            showClear: true,
            showClose: true,
            icons: {
                time: 'fa fa-clock-o',
                date: 'fa fa-calendar',
                up: 'fa fa-chevron-up',
                down: 'fa fa-chevron-down',
                previous: 'fa fa-chevron-left',
                next: 'fa fa-chevron-right',
                today: 'fa fa-dot-circle-o',
                clear: 'fa fa-trash',
                close: 'fa fa-check'
            }
        }).on('dp.change', function (event) {
            syncDateTimeRange(input, event.date || false);
            updatePreview(input);
        }).on('change input', function () {
            updatePreview(input);
        });

        $input.data('uzCalendarReady', true);

        var picker = $input.data('DateTimePicker');
        if (picker) {
            syncDateTimeRange(input, picker.date() || false);
        }
        updatePreview(input);
    }

    function initAll(root) {
        var scope = root || document;
        var datetimeInputs = scope.querySelectorAll('[data-uz-datetimepicker="1"]');

        [].forEach.call(scope.querySelectorAll('[data-uz-datepicker="1"]'), initDatePicker);
        [].forEach.call(datetimeInputs, initDateTimePicker);
        [].forEach.call(datetimeInputs, function (input) {
            var picker = $(input).data('DateTimePicker');
            syncDateTimeRange(input, picker ? picker.date() || false : false);
        });
    }

    window.LMSCalendar = {
        initAll: initAll,
        formatDate: formatDate,
        formatDateTime: formatDateTime,
        updatePreview: updatePreview
    };

    $(function () {
        initAll(document);
    });
})(window, document, window.jQuery, window.moment);
