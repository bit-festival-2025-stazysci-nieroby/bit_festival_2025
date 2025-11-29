package com.example.bit_festival

import android.content.Context
import android.util.Log
import com.google.android.gms.nearby.Nearby
import com.google.android.gms.nearby.connection.*

class NearbyManager(private val context: Context) {

    // CHANGED: P2P_CLUSTER allows M-to-N connections and is required for
    // a device to be both an advertiser and discoverer simultaneously.
    private val STRATEGY = Strategy.P2P_CLUSTER
    private val SERVICE_ID = "com.example.bit_festival"
    private val TAG = "NearbyManager"

    fun startAdvertising(nickname: String) {
        val advertisingOptions = AdvertisingOptions.Builder().setStrategy(STRATEGY).build()
        Nearby.getConnectionsClient(context)
            .startAdvertising(
                nickname,
                SERVICE_ID,
                connectionLifecycleCallback,
                advertisingOptions
            )
            .addOnSuccessListener { Log.d(TAG, "Advertising...") }
            .addOnFailureListener { e -> Log.e(TAG, "Advertising failed", e) }
    }

    fun startDiscovery() {
        val discoveryOptions = DiscoveryOptions.Builder().setStrategy(STRATEGY).build()
        Nearby.getConnectionsClient(context)
            .startDiscovery(
                SERVICE_ID,
                endpointDiscoveryCallback,
                discoveryOptions
            )
            .addOnSuccessListener { Log.d(TAG, "Discovering...") }
            .addOnFailureListener { e -> Log.e(TAG, "Discovery failed", e) }
    }

    // New helper to stop everything when "Cancel" is clicked
    fun stopAll() {
        Nearby.getConnectionsClient(context).stopAdvertising()
        Nearby.getConnectionsClient(context).stopDiscovery()
        Nearby.getConnectionsClient(context).stopAllEndpoints()
    }

    private val connectionLifecycleCallback = object : ConnectionLifecycleCallback() {
        override fun onConnectionInitiated(endpointId: String, info: ConnectionInfo) {
            // Auto-accept connection logic
            Log.d(TAG, "Connection initiated with ${info.endpointName}")
            Nearby.getConnectionsClient(context).acceptConnection(endpointId, payloadCallback)
        }

        override fun onConnectionResult(endpointId: String, result: ConnectionResolution) {
            if (result.status.isSuccess) {
                Log.d(TAG, "Connected!")
                // Connection established! Stop searching to save battery.
                Nearby.getConnectionsClient(context).stopAdvertising()
                Nearby.getConnectionsClient(context).stopDiscovery()

                // Send "Handshake" Proof
                val bytes = "PROOF_OF_MEETING_TOKEN".toByteArray()
                Nearby.getConnectionsClient(context).sendPayload(endpointId, Payload.fromBytes(bytes))
            }
        }

        override fun onDisconnected(endpointId: String) {
            Log.d(TAG, "Disconnected")
        }
    }

    private val payloadCallback = object : PayloadCallback() {
        override fun onPayloadReceived(endpointId: String, payload: Payload) {
            if (payload.type == Payload.Type.BYTES) {
                val message = String(payload.asBytes()!!)
                Log.d(TAG, "Received Proof: $message")
                // TODO: Save this 'proof' to local Room database to upload later
            }
        }
        override fun onPayloadTransferUpdate(endpointId: String, update: PayloadTransferUpdate) {}
    }

    private val endpointDiscoveryCallback = object : EndpointDiscoveryCallback() {
        override fun onEndpointFound(endpointId: String, info: DiscoveredEndpointInfo) {
            Log.d(TAG, "Found peer: ${info.endpointName}")
            // Symmetric Logic: If we see someone, request connection immediately.
            // Since both sides are doing this, Nearby API handles the contention.
            Nearby.getConnectionsClient(context)
                .requestConnection("User", endpointId, connectionLifecycleCallback)
        }
        override fun onEndpointLost(endpointId: String) {}
    }
}