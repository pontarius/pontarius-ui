/*

Pontarius integration for GNOME™.

Copyright © Jon Kristensen, 2014-2015.

This program is free software: you can redistribute it and/or modify it under
the terms of the GNU Affero General Public License as published by the Free
Software Foundation, either version 3 of the License, or (at your option) any
later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY
WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
PARTICULAR PURPOSE. See the GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License along
with this program. If not, see <http://www.gnu.org/licenses/>.

*/

const Gio = imports.gi.Gio;
const Util = imports.misc.util;

var _notifications;
var _pontarius;
var _state;

const State = {
    CREDENTIALS_UNSET: 0,
    IDENTITY_NOT_FOUND: 1,
    IDENTITIES_AVAILABLE: 2,
    CREATING_IDENTITY: 3,
    DISABLED: 4,
    AUTHENTICATING: 5,
    AUTHENTICATED: 6,
    AUTHENTICATION_DENIED: 7
};

function enable() {
    // Initialize notifications D-Bus interface. This will allow us to interact
    // with the notifications facility.
    const NotificationsInterface = '<node><interface name="org.freedesktop.Notifications"><method name="Notify"><arg type="s" name="arg_0" direction="in"></arg><arg type="u" name="arg_1" direction="in"></arg><arg type="s" name="arg_2" direction="in"></arg><arg type="s" name="arg_3" direction="in"></arg><arg type="s" name="arg_4" direction="in"></arg><arg type="as" name="arg_5" direction="in"></arg><arg type="a{sv}" name="arg_6" direction="in"></arg><arg type="i" name="arg_7" direction="in"></arg><arg type="u" name="arg_8" direction="out"></arg></method><method name="CloseNotification"><arg type="u" name="arg_0" direction="in"></arg></method><method name="GetCapabilities"><arg type="as" name="arg_0" direction="out"></arg></method><method name="GetServerInformation"><arg type="s" name="arg_0" direction="out"></arg><arg type="s" name="arg_1" direction="out"></arg><arg type="s" name="arg_2" direction="out"></arg><arg type="s" name="arg_3" direction="out"></arg></method><signal name="NotificationClosed"><arg type="u" name="arg_0"></arg><arg type="u" name="arg_1"></arg></signal><signal name="ActionInvoked"><arg type="u" name="arg_0"></arg><arg type="s" name="arg_1"></arg></signal></interface></node>';
    const NotificationsProxy = Gio.DBusProxy.makeProxyWrapper(NotificationsInterface);
    new NotificationsProxy(
        Gio.DBus.session,
        'org.freedesktop.Notifications',
        '/org/freedesktop/Notifications',
        // We want to create this proxy asynchronously, otherwise it will cause
        // a delay in gnome-shell during load.
        // TODO: Catch notification proxy creation error.
        function (notifications) {
            _notifications = notifications;

            _notifications.connectSignal('ActionInvoked', _onActionInvoked);

            // Initialize Pontarius D-Bus interface.
            // TODO: Catch notification proxy creation error.
            const PontariusInterface = '<node name="pontarius"><interface name="org.pontarius"><method name="addPeer"><arg name="jid" type="s" direction="in"/></method><method name="createIdentity"><arg name="key_id" type="ay" direction="out"/></method><method name="getContactIdentities"><arg name="contact" type="s" direction="in"/><arg name="identities" type="a{sas}" direction="out"/></method><method name="getContactPeers"><arg name="contact" type="s" direction="in"/><arg name="peers" type="a{sa{ss}}" direction="out"/></method><method name="getContacts"><arg name="contacts" type="a((ss)b)" direction="out"/></method><method name="getCredentials"><arg name="username" type="s" direction="out"/></method><method name="getIdentities"><arg name="identities" type="as" direction="out"/></method><method name="getIdentityChallenges"><arg name="key_id" type="s" direction="in"/><arg name="challenges" type="a(ssbsssb)" direction="out"/></method><method name="getSessionsByIdentity"><arg name="jid" type="s" direction="in"/><arg name="sessions" type="a(ayssssuu)" direction="out"/></method><method name="getSessionsByJID"><arg name="jid" type="s" direction="in"/><arg name="sessions" type="a(ayssssuu)" direction="out"/></method><method name="keyTrustStatus"><arg name="key_id" type="s" direction="in"/><arg name="is_trusted" type="b" direction="out"/></method><method name="getUnlinkedPeers"><arg name="unlinkedPeers" type="a{ss}" direction="out"/></method><method name="initialize"><arg name="state" type="y" direction="out"/></method><method name="initiateChallenge"><arg name="peer" type="s" direction="in"/><arg name="question" type="s" direction="in"/><arg name="secret" type="s" direction="in"/></method><method name="linkIdentity"><arg name="identity" type="s" direction="in"/><arg name="contact" type="s" direction="in"/></method><method name="identityVerified"><arg name="key_id" type="s" direction="in"/><arg name="is_verified" type="b" direction="in"/></method><method name="newContact"><arg name="name" type="s" direction="in"/><arg name="contact_id" type="s" direction="out"/></method><method name="removeChallenge"><arg name="challenge_id" type="s" direction="in"/></method><method name="removeContacts"><arg name="contact" type="s" direction="in"/></method><method name="removePeer"><arg name="peer" type="s" direction="in"/></method><method name="renameContact"><arg name="contact" type="s" direction="in"/><arg name="name" type="s" direction="in"/></method><method name="respondChallenge"><arg name="peer" type="s" direction="in"/><arg name="secret" type="s" direction="in"/></method><method name="revokeIdentity"><arg name="key_id" type="s" direction="in"/></method><method name="setCredentials"><arg name="username" type="s" direction="in"/><arg name="password" type="s" direction="in"/></method><method name="setIdentity"><arg name="keyID" type="s" direction="in"/></method><method name="unlinkIdentity"><arg name="identity" type="s" direction="in"/></method><signal name="challengeResult"><arg name="peer" type="s"/><arg name="challenge_id" type="s"/><arg name="initiator" type="s"/><arg name="result" type="b"/></signal><signal name="contactRemoved"><arg name="contact" type="s"/></signal><signal name="contactRenamed"><arg name="contact" type="s"/><arg name="name" type="s"/></signal><signal name="contactStatusChanged"><arg name="contact" type="s"/><arg name="contact_name" type="s"/><arg name="status" type="y"/></signal><signal name="identityStatusChanged"><arg name="identity" type="s"/><arg name="peer" type="s"/><arg name="contact" type="s"/><arg name="status" type="y"/></signal><signal name="identityUnlinkedSignal"><arg name="identity" type="s"/></signal><signal name="peerTrustStatusChanged"><arg name="peer" type="s"/><arg name="trust_status" type="b"/></signal><signal name="receivedChallenge"><arg name="peer" type="s"/><arg name="question" type="s"/></signal><signal name="subscriptionRequest"><arg name="peer" type="s"/></signal><signal name="unlinkedIdentityStatusChanged"><arg name="identity" type="s"/><arg name="peer" type="s"/><arg name="status" type="y"/></signal><property name="Identity" type="s" access="read"/><property name="Status" type="y" access="read"/><property name="AccountEnabled" type="b" access="readwrite"/><property name="Username" type="s" access="read"/></interface></node>';
            // TODO: Clean up code related to the properties below.
            // const PropertiesInterface = '<node name="pontarius"><interface name="org.freedesktop.DBus.Properties"><method name="Get"><arg name="interface_name" type="s" direction="in"/><arg name="property_name" type="s" direction="in"/><arg name="value" type="v" direction="out"/></method><method name="Set"><arg name="interface_name" type="s" direction="in"/><arg name="property_name" type="s" direction="in"/><arg name="value" type="v" direction="in"/></method><method name="GetAll"><arg name="interface_name" type="s" direction="in"/><arg name="props" type="a{sv}" direction="out"/></method><signal name="PropertiesChanged"><arg name="interface_name" type="s"/><arg name="changed_properties" type="a{sv}"/><arg name="invalidated_properties" type="as"/></signal></interface></node>';
            const PontariusProxy = Gio.DBusProxy.makeProxyWrapper(PontariusInterface);
            // const PropertiesProxy = Gio.DBusProxy.makeProxyWrapper(PropertiesInterface);
            _pontarius = new PontariusProxy(Gio.DBus.session, 'org.pontarius', '/pontarius');
            // this._properties = new PropertiesProxy(Gio.DBus.session, 'org.pontarius', '/pontarius');
            // TODO: Investigate this timeout.
            _pontarius.set_default_timeout(1000 * 60 * 10);
            // this._propertiesChangedId = this._properties.connectSignal('PropertiesChanged', this._onPropertiesChanged);
            _pontarius.initializeRemote(_onStatusChanged);
        }
    );
}

function disable() {
}

function init() {
}

function _onStatusChanged(result, error) {
    if(error === null) {
        _state = result;
    }
    else {
        _notifications.NotifyRemote(
            'Pontarius',
            '',
            '',
            'Unexpected Pontarius error',
            'An unexpected Pontarius-related error occurred. The error was of type "' + Gio.DBusError.get_remote_error(error) + '".',
            ['article-617bf098-277d-40c2-8be2-8ca1d2cc959f', 'Read more on the web'],
            {},
            (-1)
        );
        log('Unexpected Pontarius error: ' + Gio.DBusError.get_remote_error(error));
    }
}

function _onActionInvoked(proxy, id, key) {
    var openArticle = function (id) {
        Util.spawn(['gvfs-open', 'https://www.pontarius.org/article/' + id]);
    };

    if(key[1] === 'article-617bf098-277d-40c2-8be2-8ca1d2cc959f') {
        openArticle('617bf098-277d-40c2-8be2-8ca1d2cc959f');
    } else {
        log('Unhandled ActionInvoked signal: ' + key);
    }
};
