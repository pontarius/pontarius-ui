#!/usr/bin/gjs

/*

Pontarius User Interface: A user interface prototype for Pontarius.

Copyright © Jon Kristensen, 2014.

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

const GConf = imports.gi.GConf;
const Gdk = imports.gi.Gdk;
const Gio = imports.gi.Gio;
const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;
const Lang = imports.lang;
const Pango = imports.gi.Pango;

const PontariusState =
{
    CREDENTIALS_UNSET: 0,
    IDENTITY_NOT_FOUND: 1,
    IDENTITIES_AVAILABLE: 2,
    CREATING_IDENTITY: 3,
    DISABLED: 4,
    AUTHENTICATING: 5,
    AUTHENTICATED: 6,
    AUTHENTICATION_DENIED: 7
};

const PontariusSettings = new Lang.Class(
{
    Name: 'PontariusSettings',
    _init: function()
    {
        this.application = new Gtk.Application();
        this._gConf = GConf.Client.get_default();
        this.application.connect('activate', Lang.bind(this, this._onActivate));
        this.application.connect('shutdown', Lang.bind(this, this._onShutdown));
        this.application.connect('startup', Lang.bind(this, this._onStartup));
    },
    _onActivate: function()
    {
        this._window.show_all();
    },
    _onShutdown: function()
    {
    },
    _onStartup: function()
    {
        // Prefer dark theme.
        Gtk.Settings.get_default().gtk_application_prefer_dark_theme = true;

        // Set tab content background color to be different from the background
        // color of list boxes.
        let cssProvider = new Gtk.CssProvider();
        cssProvider.load_from_data('GtkNotebook > GtkBox { background-color: #393f3f; }');
        Gtk.StyleContext.add_provider_for_screen(Gdk.Screen.get_default(), cssProvider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);

        // Load the Glade UI.
        this._builder = new Gtk.Builder();
        this._builder.add_from_file('pontarius.glade');

        // Configure UI objects.
        this._window = this._builder.get_object('pontarius_window');
        this._window.set_default_size(820, 428);
        this._builder.get_object('xmpp_account_apply_button').connect('clicked', Lang.bind(this, function()
        {
            this._pontarius.setCredentialsRemote(this._builder.get_object('xmpp_account_xmpp_address_entry').get_text(), this._builder.get_object('xmpp_account_password_entry').get_text(), Lang.bind(this, function(result, error)
            {
                if(error === null)
                {
                    this._builder.get_object('xmpp_account_dialog').hide();
                }
                else
                {
                    // TODO: Show dialog.
                    print('setCredentials failure! ' + Gio.DBusError.get_remote_error(error));
                    let dialog = new Gtk.MessageDialog({ buttons: Gtk.ButtonsType.OK, message_type: Gtk.MessageType.ERROR, modal: true, text: "Failed to set credentials. Please verify that the username is in the form localpart@domainpart.", transient_for: this._builder.get_object('xmpp_account_dialog') });
                    dialog.connect('response', function() { dialog.hide(); });
                    dialog.show();
                }
            }));
        }));
        this._builder.get_object('xmpp_account_cancel_button').connect('clicked', Lang.bind(this, function()
        {
            this._builder.get_object('xmpp_account_dialog').hide();
        }));
        this._builder.get_object('identity_management_close_button').connect('clicked', Lang.bind(this, function()
        {
            this._builder.get_object('identity_management_dialog').hide();
        }));
        this._builder.get_object('settings_listbox').connect('row-activated', Lang.bind(this, function(listbox, listbox_row)
        {
            switch(listbox_row)
            {
                case this._builder.get_object('settings_xmpp_account_row'):
                {
                    this._builder.get_object('xmpp_account_xmpp_address_entry').set_text('');
                    this._builder.get_object('xmpp_account_password_entry').set_text('');
                    this._builder.get_object('xmpp_account_dialog').run();
                    break;
                }
                case this._builder.get_object('settings_identity_row'):
                {
                    if(this._state != PontariusState.CREDENTIALS_UNSET)
                    {
                        this._populateIdentityListBox(this._builder.get_object('identity_management_listbox'));
                        this._builder.get_object('identity_management_dialog').run();
                    }
                    break;
                }
            }
        }));
        this._builder.get_object('settings_login_automatically_switch').connect('notify::active', Lang.bind(this, function(self)
        {
            this._pontarius.AccountEnabled = self.get_active();
        }));
        this._builder.get_object('identity_management_toolitem_left_select_button').connect('clicked', Lang.bind(this, function()
        {
            this._pontarius.setIdentityRemote(this._builder.get_object('identity_management_listbox').get_selected_row().get_child().get_children()[0].get_label(), Lang.bind(this, function(result, error)
            {
                if(error === null)
                {
                    this._populateIdentityListBox(this._builder.get_object('identity_management_listbox'));
                }
                else
                {
                    print('setIdentity failure! ' + Gio.DBusError.get_remote_error(error));
                }
            }));
        }));
        this._builder.get_object('identity_management_toolitem_left_add_button').connect('clicked', Lang.bind(this, function()
        {
            this._builder.get_object('generating_identity_dialog').show();

            this._pontarius.createIdentityRemote(Lang.bind(this, function(result, error)
            {
                this._builder.get_object('generating_identity_dialog').hide();
                this._populateIdentityListBox(this._builder.get_object('identity_management_listbox'));
            }));
        }));
        this._builder.get_object('identity_management_toolitem_right_revoke_button').connect('clicked', Lang.bind(this, function()
        {
            this._builder.get_object('revoke_identity_dialog').run();
        }));
        this._builder.get_object('revoke_identity_revoke_button').connect('clicked', Lang.bind(this, function()
        {
            let selectedIdentity = this._builder.get_object('identity_management_listbox').get_selected_row().get_child().get_children()[0].get_label();
            this._builder.get_object('revoke_identity_dialog').hide();
            this._pontarius.revokeIdentitySync(selectedIdentity);
            this._populateIdentityListBox(this._builder.get_object('identity_management_listbox'));
            if(selectedIdentity == this._pontarius.Identity)
            {
                this._pontarius.Identity = null;
            }
        }));
        this._builder.get_object('contacts_remove_button').connect('clicked', Lang.bind(this, function()
        {
            this._pontarius.removePeerRemote(this._builder.get_object('contacts_listbox').get_selected_row().get_child().get_children()[1].get_label(), Lang.bind(this, function(result, error)
            {
                if(error === null)
                {
                    this._populateContactsListBox();
                }
                else
                {
                    print('removePeer failure! ' + Gio.DBusError.get_remote_error(error));
                }
            }));
        }));
        this._builder.get_object('revoke_identity_cancel_button').connect('clicked', Lang.bind(this, function()
        {
            this._builder.get_object('revoke_identity_dialog').hide();
        }));
        this._builder.get_object('contacts_history_button').connect('clicked', Lang.bind(this, function()
        {
            let treeView = this._builder.get_object('history_treeview');
            let listStore = new Gtk.ListStore();
            listStore.set_column_types([GObject.TYPE_STRING, GObject.TYPE_STRING, GObject.TYPE_STRING, GObject.TYPE_STRING]);
            let data = [
                ['2014-09-07 19:18 CET', '2FBAF74694EB0556', 'B52F81E2459FF0972BCF008BE59BDA70BDCBAD03', 'D36539A4F0083D6B75DD504D79644DF2E0DC567C'],
                ['2014-09-07 19:19 CET', '2FBAF74694EB0556', 'B52F81E2459FF0972BCF008BE59BDA70BDCBAD03', 'D36539A4F0083D6B75DD504D79644DF2E0DC567C'],
                ['2014-09-07 19:20 CET', '2FBAF74694EB0556', 'B52F81E2459FF0972BCF008BE59BDA70BDCBAD03', 'D36539A4F0083D6B75DD504D79644DF2E0DC567C']
            ];
            for(let i = 0; i < data.length; i++)
            {
                listStore.set(listStore.append(), [0, 1, 2, 3], data[i]);
            }
            treeView.set_model(listStore);
            treeView.insert_column(new Gtk.TreeViewColumn({ title: "Date" }), 0);
            treeView.insert_column(new Gtk.TreeViewColumn({ title: "Session ID" }), 1);
            treeView.insert_column(new Gtk.TreeViewColumn({ title: "Our Identity" }), 2);
            treeView.insert_column(new Gtk.TreeViewColumn({ title: "Their Identity" }), 3);
            this._builder.get_object('history_dialog').run();
        }));
        this._builder.get_object('history_button').connect('clicked', Lang.bind(this, function()
        {
            this._builder.get_object('history_dialog').hide();
        }));
        this._builder.get_object('contacts_add_button').connect('clicked', Lang.bind(this, function()
        {
            this._builder.get_object('add_contact_entry').set_text('');
            this._builder.get_object('add_contact_dialog').run();
        }));
        this._builder.get_object('add_contact_cancel_button').connect('clicked', Lang.bind(this, function()
        {
            this._builder.get_object('add_contact_dialog').hide();
        }));
        this._builder.get_object('add_contact_add_button').connect('clicked', Lang.bind(this, function()
        {
            this._pontarius.addPeerRemote(this._builder.get_object('add_contact_entry').get_text(), Lang.bind(this, function(result, error)
            {
            }));
            this._builder.get_object('add_contact_dialog').hide();
        }));
        this._hideTrustRegion();
        this.application.add_window(this._window);

        // Initialize D-Bus interface.
        const PontariusInterface = '<node name="pontarius"><interface name="org.pontarius"><method name="importKey"><arg name="location" type="s" direction="in"/><arg name="key_id" type="s" direction="out"/></method><method name="createIdentity"><arg name="key_id" type="ay" direction="out"/></method><method name="initialize"><arg name="result" type="y" direction="out"/></method><method name="markKeyVerified"><arg name="key-id" type="s" direction="in"/></method><method name="securityHistoryByJID"><arg name="peer" type="s" direction="in"/><arg name="ake_events" type="a(ubssss)" direction="out"/><arg name="challenge_events" type="a(buuss)" direction="out"/><arg name="revocation_events" type="a(su)" direction="out"/><arg name="revocation_signal_events" type="a(su)" direction="out"/></method><method name="securityHistoryByKeyID"><arg name="key_id" type="s" direction="in"/><arg name="ake_events" type="a(ubssss)" direction="out"/><arg name="challenge_events" type="a(buuss)" direction="out"/><arg name="revocation_events" type="a(su)" direction="out"/><arg name="revocation_signal_events" type="a(su)" direction="out"/></method><method name="setIdentity"><arg name="keyID" type="s" direction="in"/></method><method name="revokeIdentity"><arg name="key_id" type="s" direction="in"/></method><method name="initiateChallenge"><arg name="peer" type="s" direction="in"/><arg name="question" type="s" direction="in"/><arg name="secret" type="s" direction="in"/></method><method name="respondChallenge"><arg name="peer" type="s" direction="in"/><arg name="secret" type="s" direction="in"/></method><method name="getChallenges"><arg name="challenges" type="a(sbsssb)" direction="out"/></method><method name="getTrustStatus"><arg name="entity" type="s" direction="in"/><arg name="is_trusted" type="b" direction="out"/></method><method name="getEntityPubkey"><arg name="entity" type="s" direction="in"/><arg name="key_id" type="s" direction="out"/></method><method name="addPeer"><arg name="jid" type="s" direction="in"/></method><method name="removePeer"><arg name="peer" type="s" direction="in"/></method><method name="registerAccount"><arg name="server" type="s" direction="in"/><arg name="username" type="s" direction="in"/><arg name="password" type="s" direction="in"/></method><method name="getIdentities"><arg name="identities" type="as" direction="out"/></method><method name="setCredentials"><arg name="username" type="s" direction="in"/><arg name="password" type="s" direction="in"/></method><method name="getCredentials"><arg name="username" type="s" direction="out"/></method><method name="startAKE"><arg name="peer" type="s" direction="in"/><arg name="success" type="b" direction="out"/></method><signal name="receivedChallenge"><arg name="peer" type="s"/><arg name="challenge_id" type="s"/><arg name="question" type="s"/></signal><signal name="challengeResult"><arg name="peer" type="s"/><arg name="challenge_id" type="s"/><arg name="initiator" type="s"/><arg name="result" type="b"/></signal><signal name="challengeTimeout"><arg name="peer" type="s"/><arg name="challenge_id" type="s"/></signal><signal name="peerStatusChanged"><arg name="peer" type="s"/><arg name="status" type="s"/></signal><signal name="peerTrustStatusChanged"><arg name="peer" type="s"/><arg name="trust_status" type="s"/></signal><signal name="subscriptionRequest"><arg name="peer" type="s"/></signal><property name="UnvailableEntities" type="a(sss)" access="read"/><property name="Identity" type="s" access="read"/><property name="Status" type="y" access="read"/><property name="AccountEnabled" type="b" access="readwrite"/><property name="Username" type="s" access="read"/><property name="Peers" type="a(sb)" access="read"/><property name="AvailableEntities" type="as" access="read"/></interface></node>';
        const PropertiesInterface = '<node name="pontarius"><interface name="org.freedesktop.DBus.Properties"><method name="Get"><arg name="interface_name" type="s" direction="in"/><arg name="property_name" type="s" direction="in"/><arg name="value" type="v" direction="out"/></method><method name="Set"><arg name="interface_name" type="s" direction="in"/><arg name="property_name" type="s" direction="in"/><arg name="value" type="v" direction="in"/></method><method name="GetAll"><arg name="interface_name" type="s" direction="in"/><arg name="props" type="a{sv}" direction="out"/></method><signal name="PropertiesChanged"><arg name="interface_name" type="s"/><arg name="changed_properties" type="a{sv}"/><arg name="invalidated_properties" type="as"/></signal></interface></node>';
        const PontariusProxy = Gio.DBusProxy.makeProxyWrapper(PontariusInterface);
        const PropertiesProxy = Gio.DBusProxy.makeProxyWrapper(PropertiesInterface);
        this._pontarius = new PontariusProxy(Gio.DBus.session, 'org.pontarius', '/pontarius');
        this._properties = new PropertiesProxy(Gio.DBus.session, 'org.pontarius', '/pontarius');
        this._pontarius.set_default_timeout(1000 * 60 * 10);
        this._propertiesChangedId = this._properties.connectSignal('PropertiesChanged', Lang.bind(this, this._onPropertiesChanged));
        this._pontarius.initializeRemote(Lang.bind(this, this._onStatusChanged));
        this._populateContactsListBox();
    },
    _onPropertiesChanged: function(proxy, connection, value)
    {
        if(value[1]['Peers'] != undefined)
        {
            this._onPeersChanged();
        }
        else if(value[1]['Status'] != undefined)
        {
            this._onStatusChanged(this._pontarius.Status, null);
        }
    },
    _hideTrustRegion: function()
    {
        let label = new Gtk.Label({ label: 'Please select a contact.' });
        label.set_alignment(0.5, 0.5);
        label.show();
        this._builder.get_object('cm_box').remove(this._builder.get_object('trust_region'));
        this._builder.get_object('cm_box').pack_start(label, true, true, 10);
    },
    _showTrustRegion: function(username)
    {
        this._builder.get_object('cm_box').remove(this._builder.get_object('cm_box').get_children()[1]);
        this._builder.get_object('cm_box').pack_start(this._builder.get_object('trust_region'), true, true, 0);
        this._pontarius.getChallengesRemote(Lang.bind(this, function(challenges, error)
        {
            if(error === null)
            {
                this._challenges = challenges;
                this._populateChallengesListBox();
            }
            else
            {
                this._builder.get_object('settings_xmpp_account_value').set_text('(Unset)');
                print('getCredentials failure! ' + Gio.DBusError.get_remote_error(error));
            }
        }));
        this._pontarius.getEntityPubkeyRemote(username, Lang.bind(this, function(challenges, error)
        {
            if(error === null)
            {
                this._identity = result;
                this._builder.get_object('identity_verification_label').set_label('Not Verified');
            }
            else
            {
                this._identity = null;
                this._builder.get_object('identity_verification_label').set_label('No Identity');
            }
        }));
    },
    _onStatusChanged: function(result, error)
    {
        print('_onStatusChanged');

        if(error === null)
        {
            this._state = result;

            if(result == PontariusState.CREDENTIALS_UNSET)
            {
                print('CREDENTIALS_UNSET');
                this._showAccountValue(false);
                this._showIdentityValue(false);
                this._showAccountEnabled(false, false);
                this._builder.get_object('contacts_add_button').set_sensitive(false);
                if(this._gConf.get("/apps/pontarius/username") != undefined && this._gConf.get("/apps/pontarius/password") != undefined)
                {
                    this._pontarius.setCredentialsRemote(this._gConf.get("/apps/pontarius/username").to_string(), this._gConf.get("/apps/pontarius/password").to_string(), function(result, error)
                    {
                        if(error !== null)
                        {
                            print('setCredentials failure! ' + Gio.DBusError.get_remote_error(error));
                        }
                    });
                }
            }
            else if(result == PontariusState.IDENTITY_NOT_FOUND)
            {
                print('IDENTITY_NOT_FOUND');
                this._showAccountValue(true);
                this._showIdentityValue(false);
                this._showAccountEnabled(false, false);
                this._builder.get_object('contacts_add_button').set_sensitive(false);
            }
            else if(result == PontariusState.IDENTITIES_AVAILABLE)
            {
                print('IDENTITIES_AVAILABLE');
                this._showAccountValue(true);
                this._showIdentityValue(false);
                this._showAccountEnabled(false, false);
                this._builder.get_object('contacts_add_button').set_sensitive(false);
            }
            else if(result == PontariusState.CREATING_IDENTITY)
            {
                print('CREATING_IDENTITY');
                this._showAccountValue(true);
                this._showIdentityValue(false);
                this._showAccountEnabled(false, false);
                this._builder.get_object('contacts_add_button').set_sensitive(false);
            }
            else if(result == PontariusState.DISABLED)
            {
                print('DISABLED');
                this._showAccountValue(true);
                this._showIdentityValue(true);
                this._showAccountEnabled(true, false);
                this._builder.get_object('contacts_add_button').set_sensitive(false);
            }
            else if(result == PontariusState.AUTHENTICATED)
            {
                print('OTHER STATE');
                this._showAccountValue(true);
                this._showIdentityValue(true);
                this._showAccountEnabled(true, true);
                this._builder.get_object('contacts_add_button').set_sensitive(true);
            }
            else
            {
                print('OTHER STATE');
                this._showAccountValue(true);
                this._showIdentityValue(true);
                this._showAccountEnabled(true, true);
                this._builder.get_object('contacts_add_button').set_sensitive(false);
            }
        }
        else
        {
            print('_onStatusChanged error! ' + Gio.DBusError.get_remote_error(error));
        }
    },
    _showAccountValue: function(set)
    {
        if(set)
        {
            this._pontarius.getCredentialsRemote(Lang.bind(this, function(result, error)
            {
                if(error === null)
                {
                    this._builder.get_object('settings_xmpp_account_value').set_text(result + '');
                }
                else
                {
                    this._builder.get_object('settings_xmpp_account_value').set_text('(Unset)');
                    print('getCredentials failure! ' + Gio.DBusError.get_remote_error(error));
                }
            }));
        }
        else
        {
            this._builder.get_object('settings_xmpp_account_value').set_text('(Unset)');
        }
    },
    _showIdentityValue: function(set)
    {
        if(set)
        {
            this._builder.get_object('settings_identity_value').set_text(this._pontarius.Identity + '');
        }
        else
        {
            this._builder.get_object('settings_identity_value').set_text('(Unset)');
        }
    },
    _showAccountEnabled: function(sensitive, active)
    {
        this._builder.get_object('settings_login_automatically_switch').set_sensitive(sensitive);
        this._builder.get_object('settings_login_automatically_switch').set_active(active && this._pontarius.AccountEnabled);
    },
    _emptyListBox: function(listbox)
    {
        let row = null;
        while((row = listbox.get_row_at_index(0)) != null)
        {
            listbox.remove(row);
        }
    },
    _populateIdentityListBox: function(listbox)
    {
        this._pontarius.getIdentitiesRemote(Lang.bind(this, function(result, error)
        {
            if(error === null)
            {
                this._builder.get_object('identity_management_toolitem_left_select_button').set_sensitive(false);

                this._emptyListBox(listbox);

                let identities = result[0];

                for(let i = 0; i < identities.length; i++)
                {
                    let label = new Gtk.Label({ label: identities[i] + '' });
                    label.set_alignment(0, 0.5);
                    label.set_margin_bottom(6);
                    label.set_margin_top(6);
                    label.show();

                    let image = Gtk.Image.new_from_icon_name('object-select-symbolic', 0);
                    if(this._pontarius.Identity + '' == identities[i])
                    {
                        image.show();
                    }

                    let box = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL });
                    box.pack_start(label, true, true, 10);
                    box.pack_start(image, false, true, 10);
                    box.show();

                    listbox.add(box);
                }

                listbox.connect('row-selected', Lang.bind(this, function(box, row)
                {
                    if(row !== null)
                    {
                        if(row.get_child().get_children()[0].get_label() == this._pontarius.Identity)
                        {
                            this._builder.get_object('identity_management_toolitem_left_select_button').set_sensitive(false);
                        }
                        else
                        {
                            this._builder.get_object('identity_management_toolitem_left_select_button').set_sensitive(true);
                        }
                    }
                    else
                    {
                        print('Row deselected!');
                    }
                }));
            }
            else
            {
                print('getIdentities failure! ' + Gio.DBusError.get_remote_error(error));
            }
        }));
    },
    _onPeersChanged: function(result, error)
    {
        print('_onPeersChanged');

        this._populateContactsListBox();
    },
    _populateContactsListBox: function()
    {
        let listbox = this._builder.get_object('contacts_listbox');

        this._builder.get_object('contacts_remove_button').set_sensitive(false);
        this._builder.get_object('contacts_history_button').set_sensitive(false);

        this._emptyListBox(listbox);

        let peers = this._pontarius.Peers;

        if(peers == null)
        {
            return;
        }

        let onlinePeers = [];
        let offlinePeers = [];

        for(let i = 0; i < peers.length; i++)
        {
            let [address, online] = peers[i];

            if(online)
            {
                onlinePeers.push([address, true]);
            }
            else
            {
                offlinePeers.push([address, false]);
            }
        }

        peers = onlinePeers.concat(offlinePeers);

        for(let i = 0; i < peers.length; i++)
        {
            let [address, online] = peers[i];

            let availabilityLabel = new Gtk.Label();
            if(online)
            {
                availabilityLabel.set_markup('<span color="#8ae234" font="16">●</span>');
            }
            else
            {
                availabilityLabel.set_markup('<span color="#aaaaaa" font="16">●</span>');
            }
            availabilityLabel.set_alignment(0, 0.5);
            availabilityLabel.set_margin_bottom(6);
            availabilityLabel.set_margin_top(6);
            availabilityLabel.show();

            let addressLabel = new Gtk.Label({ label: address + '' });
            addressLabel.set_alignment(0, 0.5);
            addressLabel.set_margin_bottom(6);
            addressLabel.set_margin_top(6);
            addressLabel.show();

            let image = Gtk.Image.new_from_icon_name('object-select-symbolic', 0);
            // if()
            // {
            //    image.show();
            // }
            // else
            // {
                image.clear();
            // }


            // GtkBox
            let box = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL });
            box.pack_start(availabilityLabel, false, true, 10);
            box.pack_start(addressLabel, true, true, 0);
            box.pack_start(image, false, true, 10);
            box.show();

            listbox.add(box);
        }

        listbox.connect('row-selected', Lang.bind(this, function(box, row)
        {
            if(row !== null)
            {
                this._builder.get_object('contacts_remove_button').set_sensitive(true);
                this._builder.get_object('contacts_history_button').set_sensitive(true);
                this._showTrustRegion(row.get_child().get_children()[1].get_label());
            }
            else
            {
                this._hideTrustRegion();
                this._builder.get_object('contacts_remove_button').set_sensitive(false);
                this._builder.get_object('contacts_history_button').set_sensitive(false);
            }
        }));
    },
    _populateChallengesListBox: function()
    {
        let listbox = this._builder.get_object('challenge_listbox');
        let challenges = this._challenges;

        this._builder.get_object('challenge_remove_button').set_sensitive(false);

        this._emptyListBox(listbox);

        for(let i = 0; i < challenges.length; i++)
        {
        }

        listbox.connect('row-selected', Lang.bind(this, function(box, row)
        {
            if(row !== null)
            {
                this._builder.get_object('challenge_remove_button').set_sensitive(false);
            }
            else
            {
                print('Row deselected!');
            }
        }));
    }
});

let app = new PontariusSettings();
app.application.run(ARGV);
