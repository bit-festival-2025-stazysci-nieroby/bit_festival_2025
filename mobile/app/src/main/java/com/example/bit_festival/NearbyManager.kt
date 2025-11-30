package com.example.bit_festival

import android.content.Context
import android.util.Log
import com.google.android.gms.nearby.Nearby
import com.google.android.gms.nearby.connection.*
import java.nio.charset.StandardCharsets

class NearbyManager(
    private val context: Context,
    private val onStatusUpdate: (String) -> Unit,
    // Updated callback signature to include UID and Name
    private val onLocationReceived: (Double, Double, String, String) -> Unit,
    private val onConnected: (String) -> Unit
) {

    private val STRATEGY = Strategy.P2P_CLUSTER
    private val SERVICE_ID = "com.example.bit_festival"
    private val TAG = "NearbyManager"
    private var myNickname: String = ""

    // ... (startAdvertising, startDiscovery, stopAll remain unchanged) ...

    fun startAdvertising(nickname: String) {
        this.myNickname = nickname
        val advertisingOptions = AdvertisingOptions.Builder().setStrategy(STRATEGY).build()
        Nearby.getConnectionsClient(context)
            .startAdvertising(
                nickname,
                SERVICE_ID,
                connectionLifecycleCallback,
                advertisingOptions
            )
            .addOnSuccessListener {
                Log.d(TAG, "Advertising...")
                onStatusUpdate("Broadcasting as $nickname...")
            }
            .addOnFailureListener { e ->
                Log.e(TAG, "Advertising failed", e)
                onStatusUpdate("Broadcast failed: ${e.message}")
            }
    }

    fun startDiscovery() {
        val discoveryOptions = DiscoveryOptions.Builder().setStrategy(STRATEGY).build()
        Nearby.getConnectionsClient(context)
            .startDiscovery(
                SERVICE_ID,
                endpointDiscoveryCallback,
                discoveryOptions
            )
            .addOnSuccessListener {
                Log.d(TAG, "Discovering...")
            }
            .addOnFailureListener { e ->
                Log.e(TAG, "Discovery failed", e)
                onStatusUpdate("Search failed: ${e.message}")
            }
    }

    fun stopAll() {
        Nearby.getConnectionsClient(context).stopAdvertising()
        Nearby.getConnectionsClient(context).stopDiscovery()
        Nearby.getConnectionsClient(context).stopAllEndpoints()
        onStatusUpdate("Ready to connect")
    }

    // Updated to send UID and Name
    fun sendLocation(lat: Double, lng: Double, endpointId: String, myUid: String, myName: String) {
        // Format: "LOC:latitude,longitude,uid,name"
        val msg = "LOC:$lat,$lng,$myUid,$myName"
        Log.d(TAG, "Sending Payload: $msg to $endpointId")
        val bytes = msg.toByteArray(StandardCharsets.UTF_8)
        Nearby.getConnectionsClient(context).sendPayload(endpointId, Payload.fromBytes(bytes))
    }

    private val connectionLifecycleCallback = object : ConnectionLifecycleCallback() {
        override fun onConnectionInitiated(endpointId: String, info: ConnectionInfo) {
            Log.d(TAG, "Connection initiated with ${info.endpointName}")
            onStatusUpdate("Found ${info.endpointName}! Connecting...")
            Nearby.getConnectionsClient(context).acceptConnection(endpointId, payloadCallback)
        }

        override fun onConnectionResult(endpointId: String, result: ConnectionResolution) {
            if (result.status.isSuccess) {
                Log.d(TAG, "Connected!")
                onStatusUpdate("Connected! Swapping Data...")

                Nearby.getConnectionsClient(context).stopAdvertising()
                Nearby.getConnectionsClient(context).stopDiscovery()

                onConnected(endpointId)
            } else {
                onStatusUpdate("Connection failed. Retrying...")
            }
        }

        override fun onDisconnected(endpointId: String) {
            Log.d(TAG, "Disconnected")
            onStatusUpdate("Disconnected from peer.")
        }
    }

    private val payloadCallback = object : PayloadCallback() {
        override fun onPayloadReceived(endpointId: String, payload: Payload) {
            if (payload.type == Payload.Type.BYTES) {
                val message = String(payload.asBytes()!!, StandardCharsets.UTF_8)
                Log.d(TAG, "Received Payload: $message")

                if (message.startsWith("LOC:")) {
                    try {
                        val parts = message.removePrefix("LOC:").split(",")
                        // Expecting 4 parts: lat, lng, uid, name
                        if (parts.size >= 4) {
                            val lat = parts[0].toDouble()
                            val lng = parts[1].toDouble()
                            val uid = parts[2]
                            val name = parts[3]

                            onLocationReceived(lat, lng, uid, name)
                            onStatusUpdate("Data received from $name!")
                        } else if (parts.size == 2) {
                            // Backwards compatibility for old format (lat, lng only)
                            val lat = parts[0].toDouble()
                            val lng = parts[1].toDouble()
                            onLocationReceived(lat, lng, "unknown_uid", "Unknown Friend")
                        }
                    } catch (e: Exception) {
                        Log.e(TAG, "Error parsing payload", e)
                    }
                }
            }
        }
        override fun onPayloadTransferUpdate(endpointId: String, update: PayloadTransferUpdate) {}
    }

    private val endpointDiscoveryCallback = object : EndpointDiscoveryCallback() {
        override fun onEndpointFound(endpointId: String, info: DiscoveredEndpointInfo) {
            Log.d(TAG, "Found peer: ${info.endpointName}")

            if (myNickname > info.endpointName) {
                onStatusUpdate("Found ${info.endpointName}. Requesting connection...")
                Nearby.getConnectionsClient(context)
                    .requestConnection(myNickname, endpointId, connectionLifecycleCallback)
            } else {
                onStatusUpdate("Found ${info.endpointName}. Waiting for them...")
            }
        }
        override fun onEndpointLost(endpointId: String) {}
    }
}
