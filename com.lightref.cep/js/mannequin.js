/*
 * mannequin.js - controle de pose do manequim posavel (body-kun) do LightRef.
 *
 * Recebe o GLB ja carregado (SkinnedMesh + rig Rigify), mapeia as articulacoes
 * controlaveis e expoe rotacao por sliders (Euler) e por arraste no visor
 * (estilo tecla R do Blender).
 *
 * Detalhes do rig exportado (verificados no GLB):
 *  - A mesh e deformada pelos bones DEF-*. O glTF nao exporta constraints, entao
 *    girar os controles FK/IK nao move a mesh.
 *  - A coluna DEF-spine..DEF-spine.006 e uma cadeia separada. Os bracos ficam
 *    pendurados em ORG-shoulder <- ORG-spine.003, e as coxas em ORG-spine.
 *    Por isso as articulacoes do tronco giram o par DEF + ORG juntos (mesmo
 *    rest pose), senao o peito se move e os bracos ficam para tras.
 *  - O ombro usa ORG-shoulder, que e pai de DEF-shoulder E de DEF-upper_arm.
 *
 * ES5 puro. Depende de THREE.
 */
(function (global) {
    'use strict';

    var JOINTS = [
        { id: 'spineLow',  bones: ['DEF-spine', 'ORG-spine'],         label: 'Quadril',      axes: ['x', 'y', 'z'], range: 60 },
        { id: 'spineMid',  bones: ['DEF-spine.002', 'ORG-spine.002'], label: 'Tronco',       axes: ['x', 'y', 'z'], range: 45 },
        { id: 'chest',     bones: ['DEF-spine.003', 'ORG-spine.003'], label: 'Peito',        axes: ['x', 'y', 'z'], range: 40 },
        { id: 'neck',      bones: ['DEF-spine.004'],                  label: 'Pescoco',      axes: ['x', 'y', 'z'], range: 45 },
        { id: 'head',      bones: ['DEF-spine.006'],                  label: 'Cabeca',       axes: ['x', 'y', 'z'], range: 60 },

        { id: 'shoulderL', bones: ['ORG-shoulder.L'],  label: 'Ombro E',     axes: ['x', 'y', 'z'], range: 40 },
        { id: 'armL',      bones: ['DEF-upper_arm.L'], label: 'Braco E',     axes: ['x', 'y', 'z'], range: 180 },
        { id: 'forearmL',  bones: ['DEF-forearm.L'],   label: 'Antebraco E', axes: ['x', 'y', 'z'], range: 150 },
        { id: 'handL',     bones: ['DEF-hand.L'],      label: 'Mao E',       axes: ['x', 'y', 'z'], range: 90 },

        { id: 'shoulderR', bones: ['ORG-shoulder.R'],  label: 'Ombro D',     axes: ['x', 'y', 'z'], range: 40 },
        { id: 'armR',      bones: ['DEF-upper_arm.R'], label: 'Braco D',     axes: ['x', 'y', 'z'], range: 180 },
        { id: 'forearmR',  bones: ['DEF-forearm.R'],   label: 'Antebraco D', axes: ['x', 'y', 'z'], range: 150 },
        { id: 'handR',     bones: ['DEF-hand.R'],      label: 'Mao D',       axes: ['x', 'y', 'z'], range: 90 },

        { id: 'thighL',    bones: ['DEF-thigh.L'],     label: 'Coxa E',      axes: ['x', 'y', 'z'], range: 120 },
        { id: 'shinL',     bones: ['DEF-shin.L'],      label: 'Joelho E',    axes: ['x', 'y', 'z'], range: 150 },
        { id: 'footL',     bones: ['DEF-foot.L'],      label: 'Pe E',        axes: ['x', 'y', 'z'], range: 60 },

        { id: 'thighR',    bones: ['DEF-thigh.R'],     label: 'Coxa D',      axes: ['x', 'y', 'z'], range: 120 },
        { id: 'shinR',     bones: ['DEF-shin.R'],      label: 'Joelho D',    axes: ['x', 'y', 'z'], range: 150 },
        { id: 'footR',     bones: ['DEF-foot.R'],      label: 'Pe D',        axes: ['x', 'y', 'z'], range: 60 }
    ];

    var AXIS_LABEL = { x: 'Eixo X', y: 'Eixo Y', z: 'Eixo Z' };
    var DEG = 180 / Math.PI;

    function Mannequin(root) {
        this.root = root;
        this.bones = {};        // nome -> THREE.Bone
        this.controls = {};     // jointId -> { list:[{bone, base}], rot:{x,y,z} }
        this.boneToJoint = {};  // nome do bone -> jointId
        this._index();
        this._captureBase();
    }

    Mannequin.prototype._index = function () {
        var self = this;
        this.root.traverse(function (o) { if (o.isBone) self.bones[o.name] = o; });
    };

    // Guarda a rotacao de repouso de cada bone. A pose e sempre base * delta.
    Mannequin.prototype._captureBase = function () {
        for (var i = 0; i < JOINTS.length; i++) {
            var j = JOINTS[i];
            var list = [];
            for (var k = 0; k < j.bones.length; k++) {
                var b = this.bones[j.bones[k]];
                if (b) list.push({ bone: b, base: b.quaternion.clone() });
            }
            if (!list.length) continue;
            this.controls[j.id] = { list: list, rot: { x: 0, y: 0, z: 0 } };
            for (var m = 0; m < list.length; m++) this.boneToJoint[list[m].bone.name] = j.id;
        }
    };

    Mannequin.prototype.getJoints = function () {
        var out = [];
        for (var i = 0; i < JOINTS.length; i++) if (this.controls[JOINTS[i].id]) out.push(JOINTS[i]);
        return out;
    };

    Mannequin.prototype.jointInfo = function (id) {
        for (var i = 0; i < JOINTS.length; i++) if (JOINTS[i].id === id) return JOINTS[i];
        return null;
    };

    Mannequin.prototype.axisLabel = function (axis) { return AXIS_LABEL[axis] || axis; };

    // Aplica o mesmo delta local em todos os bones da articulacao (par DEF + ORG).
    Mannequin.prototype._applyDelta = function (c, delta) {
        for (var i = 0; i < c.list.length; i++) {
            c.list[i].bone.quaternion.copy(c.list[i].base).multiply(delta);
        }
    };

    function eulerToQuat(r) {
        return new THREE.Quaternion().setFromEuler(new THREE.Euler(r.x / DEG, r.y / DEG, r.z / DEG, 'XYZ'));
    }

    // ---------- Sliders ----------
    Mannequin.prototype.setRotation = function (id, axis, deg) {
        var c = this.controls[id];
        if (!c) return;
        c.rot[axis] = deg;
        this._applyDelta(c, eulerToQuat(c.rot));
    };

    Mannequin.prototype.getRotation = function (id) {
        var c = this.controls[id];
        return c ? { x: c.rot.x, y: c.rot.y, z: c.rot.z } : null;
    };

    Mannequin.prototype.resetPose = function () {
        var ident = new THREE.Quaternion();
        for (var id in this.controls) {
            if (!this.controls.hasOwnProperty(id)) continue;
            this.controls[id].rot = { x: 0, y: 0, z: 0 };
            this._applyDelta(this.controls[id], ident);
        }
    };

    Mannequin.prototype.getPose = function () {
        var pose = {};
        for (var id in this.controls) {
            if (!this.controls.hasOwnProperty(id)) continue;
            var r = this.controls[id].rot;
            pose[id] = { x: r.x, y: r.y, z: r.z };
        }
        return pose;
    };

    Mannequin.prototype.applyPose = function (pose) {
        if (!pose) return;
        for (var id in pose) {
            if (!pose.hasOwnProperty(id) || !this.controls[id]) continue;
            var r = pose[id];
            this.controls[id].rot = { x: r.x || 0, y: r.y || 0, z: r.z || 0 };
            this._applyDelta(this.controls[id], eulerToQuat(this.controls[id].rot));
        }
    };

    // ---------- Arraste no visor (estilo R do Blender) ----------
    // Guarda o estado no inicio do arraste; as rotacoes seguintes sao relativas a ele.
    Mannequin.prototype.beginDrag = function (id) {
        var c = this.controls[id];
        if (!c) return;
        this.root.updateMatrixWorld(true);
        var primary = c.list[0].bone;
        c.dragStartWorld = new THREE.Quaternion();
        primary.getWorldQuaternion(c.dragStartWorld);
        c.dragParentWorld = new THREE.Quaternion();
        if (primary.parent) primary.parent.getWorldQuaternion(c.dragParentWorld);
    };

    /*
     * Aplica uma rotacao em espaco world (qWorld) sobre a orientacao do inicio do
     * arraste. Convertemos para espaco local do bone, tiramos o delta em relacao a
     * pose de repouso e replicamos esse delta nos bones pareados.
     */
    Mannequin.prototype.dragRotateWorld = function (id, qWorld) {
        var c = this.controls[id];
        if (!c || !c.dragStartWorld) return;
        var newWorld = qWorld.clone().multiply(c.dragStartWorld);
        var local = c.dragParentWorld.clone().conjugate().multiply(newWorld);
        var delta = c.list[0].base.clone().conjugate().multiply(local);
        this._applyDelta(c, delta);
        // Mantem os sliders em sincronia com a pose feita no arraste.
        var e = new THREE.Euler().setFromQuaternion(delta, 'XYZ');
        c.rot = { x: Math.round(e.x * DEG), y: Math.round(e.y * DEG), z: Math.round(e.z * DEG) };
    };

    // ---------- Selecao ----------
    Mannequin.prototype.jointWorldPosition = function (id) {
        var c = this.controls[id];
        if (!c) return null;
        var v = new THREE.Vector3();
        c.list[0].bone.getWorldPosition(v);
        return v;
    };

    Mannequin.prototype.nearestJoint = function (worldPoint) {
        var best = null, bestDist = Infinity;
        for (var id in this.controls) {
            if (!this.controls.hasOwnProperty(id)) continue;
            var d = this.jointWorldPosition(id).distanceTo(worldPoint);
            if (d < bestDist) { bestDist = d; best = id; }
        }
        return best;
    };

    // Sobe na hierarquia a partir de um bone ate achar um que seja articulacao.
    Mannequin.prototype.jointForBone = function (bone) {
        while (bone) {
            if (this.boneToJoint[bone.name]) return this.boneToJoint[bone.name];
            bone = bone.parent;
        }
        return null;
    };

    /*
     * Clique direto no corpo: usa os pesos de skin do triangulo clicado para saber
     * qual bone domina aquela regiao (ex: antebraco) e sobe ate a articulacao.
     * E o que torna o clique preciso sem precisar acertar a esfera.
     */
    Mannequin.prototype.pickJointFromHit = function (hit) {
        var obj = hit.object;
        var geo = obj.geometry;
        if (!obj.isSkinnedMesh || !hit.face || !geo.attributes.skinIndex) return this.nearestJoint(hit.point);
        var si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight;
        var weights = {};
        var verts = [hit.face.a, hit.face.b, hit.face.c];
        for (var v = 0; v < 3; v++) {
            var vi = verts[v];
            var idx = [si.getX(vi), si.getY(vi), si.getZ(vi), si.getW(vi)];
            var wts = [sw.getX(vi), sw.getY(vi), sw.getZ(vi), sw.getW(vi)];
            for (var k = 0; k < 4; k++) weights[idx[k]] = (weights[idx[k]] || 0) + wts[k];
        }
        var bestIdx = null, bestW = -1;
        for (var key in weights) if (weights.hasOwnProperty(key) && weights[key] > bestW) { bestW = weights[key]; bestIdx = key; }
        var bone = (bestIdx !== null && obj.skeleton) ? obj.skeleton.bones[bestIdx] : null;
        return this.jointForBone(bone) || this.nearestJoint(hit.point);
    };

    // ---------- Marcadores (pontos clicaveis nas juntas) ----------
    // Ficam em espaco world (filhos da cena), posicionados a cada frame.
    Mannequin.prototype.buildJointMarkers = function () {
        var group = new THREE.Group();
        group.name = 'jointMarkers';
        this._markers = {};
        for (var id in this.controls) {
            if (!this.controls.hasOwnProperty(id)) continue;
            var sphere = new THREE.Mesh(
                new THREE.SphereGeometry(0.05, 12, 12),
                new THREE.MeshBasicMaterial({ color: 0x33c6ff, depthTest: false, transparent: true, opacity: 0.9 })
            );
            sphere.renderOrder = 999;
            sphere.userData.jointId = id;
            group.add(sphere);
            this._markers[id] = sphere;
        }
        this._markerGroup = group;
        this.updateJointMarkers();
        return group;
    };

    Mannequin.prototype.updateJointMarkers = function () {
        if (!this._markers) return;
        for (var id in this._markers) {
            if (!this._markers.hasOwnProperty(id)) continue;
            var p = this.jointWorldPosition(id);
            if (p) this._markers[id].position.copy(p);
        }
    };

    Mannequin.prototype.setMarkersVisible = function (v) {
        if (this._markerGroup) this._markerGroup.visible = v;
    };

    Mannequin.prototype.highlightJoint = function (jointId) {
        if (!this._markers) return;
        for (var id in this._markers) {
            if (!this._markers.hasOwnProperty(id)) continue;
            var sel = (id === jointId);
            this._markers[id].material.color.set(sel ? 0xde2246 : 0x33c6ff);
            this._markers[id].scale.setScalar(sel ? 1.8 : 1.0);
        }
    };

    Mannequin.prototype.markerMeshes = function () {
        var out = [];
        if (this._markers) for (var id in this._markers) if (this._markers.hasOwnProperty(id)) out.push(this._markers[id]);
        return out;
    };

    global.LightRefMannequin = Mannequin;
})(window);