// DOMContentLoaded is fired once the document has been loaded and parsed,
// but without waiting for other external resources to load (css/images/etc)
// That makes the app more responsive and perceived as faster.
// https://developer.mozilla.org/Web/Reference/Events/DOMContentLoaded
window.addEventListener('DOMContentLoaded', function() {

  // We'll ask the browser to use strict code to help us catch errors earlier.
  // https://developer.mozilla.org/Web/JavaScript/Reference/Functions_and_function_scope/Strict_mode
  'use strict';

  var translate = navigator.mozL10n.get;

  // We want to wait until the localisations library has loaded all the strings.
  // So we'll tell it to let us know once it's ready.
  navigator.mozL10n.once(start);

  // ---

  var mozContactsCheck, idbCheck, idbClear, idbFill, log;

  function start() {
    mozContactsCheck = document.getElementById('mozContacts');
    idbCheck = document.getElementById('checkIdb');
    idbClear = document.getElementById('clearDB');
    idbFill = document.getElementById('fillDB');
    log = document.getElementById('log');

    mozContactsCheck.addEventListener('click', checkMozContacts);
    idbCheck.addEventListener('click', checkIdb);
    idbClear.addEventListener('click', clearIdb);
    idbFill.addEventListener('click', fillIdb);
  }

  function toggleDisableAll(disable) {
    mozContactsCheck.disabled = disable;
    toggleDisableIdb(disable);
  }

  function toggleDisableIdb(disable) {
    idbCheck.disabled = disable;
    idbClear.disabled = disable;
    idbFill.disabled = disable;
  }

  function checkMozContacts() {
    console.log('Check mozContacts');
    toggleDisableAll(true);
    var start = Date.now();
    var end = 0;
    var num = 0;
    var options = {
      sortBy: 'givenName',
      sortOrder: 'ascending'
    };
    var cursor = navigator.mozContacts.getAll(options);
    cursor.onsuccess = function onSuccess(evt) {
      var contact = evt.target.result;
      num++;
      if (num === 1) {
        displayMessage('first contact', num, Date.now() - start);
      }
      if (contact) {
        var x = Date.now();
        getContactData(contact);
        cursor.continue();
      } else {
        displayMessage('mozContacts', num, Date.now() - start);
        toggleDisableAll(false);
      }
    }
    cursor.onerror = function onError(evt) {
      displayMessage('ERROR in mozContacts', num, 0);
      toggleDisableAll(false);
    }
  }

  function checkIdb() {
    console.log('Check idb');
    toggleDisableAll(true);
    var end = 0;
    var num = 0;
    var start = Date.now();
    getDatabase().then(function(db) {
      var transaction = db.transaction(["list"], "readwrite");
      var objectStore = transaction.objectStore("list");
      var index = objectStore.index('orderString');
      var request = index.openCursor(IDBKeyRange.lowerBound(0), 'next');
      request.onsuccess = function(event) {
        var cursor = request.result;
        if (!cursor) {
          displayMessage('idbx', num, Date.now() - start);
          toggleDisableAll(false);
          return;
        }
        var contact = cursor.value;
        num++;
        if (num === 1) {
          displayMessage('first contact from idbx', num, Date.now() - start);
        }
        cursor.continue();
      }
    }, function() {
      console.error('Error getting db');
      toggleDisableAll(false);
    });
  }

  function clearIdb() {
    console.log('Clear idb');
    toggleDisableAll(true);
    getDatabase().then(function(db){
      var transaction = db.transaction(["list"], "readwrite");
      var objectStore = transaction.objectStore("list");

      var req = objectStore.clear();
      req.onsuccess = req.onerror = function() {
        toggleDisableAll(false);
      };
    }, function(e) {
      console.error(e);
      toggleDisableAll(false);
    });
  }

  function fillIdb() {
    console.log('Fill idb');
    toggleDisableAll(true);
    var options = {
      sortBy: 'givenName',
      sortOrder: 'ascending'
    };
    var cursor = navigator.mozContacts.getAll(options);
    var contacts = [];
    cursor.onsuccess = function onSuccess(evt) {
      var contact = evt.target.result;
      if (contact) {
        var data = getContactData(contact);
        contacts.push(data);
        cursor.continue();
      } else {
        getDatabase().then(function(db) {
          var transaction = db.transaction(["list"], "readwrite");
          var objectStore = transaction.objectStore("list");

          function saveContact(num) {
            if (num === contacts.length) {
              displayMessage('Filled db', num, 0);
              toggleDisableAll(false);    
              return;
            }

            try {
              var request = objectStore.add(contacts[num]);
              request.onsuccess = function() {
                saveContact(num+1);
              };
              request.onerror = function(e) {
                console.error(e);
                toggleDisableAll(false);
              };
            } catch(eeer) {
              alert(eeer);
            }
          }

          saveContact(0);
          
        }, function(e) {
          console.error(e);
        });
      }
    }
    cursor.onerror = function onError(evt) {
      displayMessage('ERROR filling db', num, 0);
      toggleDisableAll(false);
    }
  }

  function displayMessage(msg, num, timeMiliseconds) {
    log.textContent = 'Test :: ' + msg + ' :: for ' + num +
     ' contacts took ' + timeMiliseconds + ' miliseconds' ;
  }

  function getContactData(contact) {
    var result = {};

    result.displayName = getDisplayName(contact);
    result.orderString = [getStringToBeOrdered(contact, result.displayName)];
    result.group = getFastGroupName(contact);
    result.org = Array.isArray(contact.org) && contact.org.length > 0 ? contact.org[0] : null;
    //result.photo = contact.photo && contact.photo[0] ? contact.photo[0] : null;
    result.id = contact.id;

    return result;
  }

  // From list.js in contacts
  function getDisplayName(contact) {
    if (hasName(contact)) {
      return { givenName: contact.givenName, familyName: contact.familyName };
    }

    var givenName = [];
    if (contact.org && contact.org.length > 0) {
      givenName.push(contact.org[0]);
    } else if (contact.tel && contact.tel.length > 0) {
      givenName.push(contact.tel[0].value);
    } else if (contact.email && contact.email.length > 0) {
      givenName.push(contact.email[0].value);
    } else {
      givenName.push('noName');
    }

    return { givenName: givenName, modified: true };
  };

  function hasName(contact) {
    return (Array.isArray(contact.givenName) && contact.givenName[0] &&
              contact.givenName[0].trim()) ||
            (Array.isArray(contact.familyName) && contact.familyName[0] &&
              contact.familyName[0].trim());
  };

  function getStringToBeOrdered(contact, display) {
    var ret = [];

    // If no display name is specified, then use the contact directly. This
    // is necessary so we can use the raw contact info when generating the
    // group name.
    display = display || contact;
    var familyName, givenName;

    familyName = getStringValue(display, 'familyName') || '';
    givenName = getStringValue(display, 'givenName') || '';

    var first = givenName, second = familyName;

    ret.push(first);
    ret.push(second);

    if (first !== '' || second !== '') {
      return Normalizer.toAscii(ret.join('')).toUpperCase().trim();
    }
    ret.push(contact.org);
    ret.push(contact.tel && contact.tel.length > 0 ?
      contact.tel[0].value.trim() : '');
    ret.push(contact.email && contact.email.length > 0 ?
      contact.email[0].value.trim() : '');
    ret.push('#');

    return Normalizer.toAscii(ret.join('')).toUpperCase().trim();
  };

  var GROUP_ORDER = (function getGroupOrder() {
    var letters =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZ' + // Roman
      'ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ' + // Greek
      'АБВГДЂЕЁЖЗИЙЈКЛЉМНЊОПРСТЋУФХЦЧЏШЩЭЮЯ'; // Cyrillic (Russian + Serbian)
    var order = { 'favorites': 0 };
    for (var i = 0; i < letters.length; i++) {
      order[letters[i]] = i + 1;
    }
    order.und = i + 1;
    return order;
  })();

  function getFastGroupName(contact) {
    var field = 'familyName';
    var value = contact[field] ? contact[field][0] : null;
    if (!value || !value.length) {
      return null;
    }

    var ret = value.charAt(0).toUpperCase();
    if (!(ret in GROUP_ORDER)) {
      return null;
    }
    return ret;
  };

  function getStringValue(contact, field) {
    if (contact[field] && contact[field][0]) {
      return String(contact[field][0]).trim();
    }

    return null;
  };

  function getDatabase() {
    return new Promise(function(resolve, reject) {
      var db;
      var request = indexedDB.open("MyTestDatabase", 2);
      request.onerror = reject;
      request.onsuccess = function(event) {
        db = request.result;
        resolve(db);
      };
      request.onupgradeneeded = function(event) {
        var db = event.target.result;

        var objectStore = db.createObjectStore("list", { keyPath: "id" });
        objectStore.createIndex("orderString", "orderString", { unique: false });
        objectStore.createIndex("displayNameGiven", "displayName.givenName", { unique: false });
        objectStore.createIndex("displayNameFamily", "displayName.familyName", { unique: false });
        objectStore.createIndex("org", "org", { unique: false });


        objectStore.transaction.oncomplete = function(evt) {
          resolve(db);
        }
      };
    });
  }

});
