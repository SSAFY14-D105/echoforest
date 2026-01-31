import Phaser from 'phaser';
import BaseGameScene from '../scenes/BaseGameScene';
import TiledHelper from './TiledHelper';
import { Key, Lock, Spike, Goal, Spring, Elevator, MovableBlock, Bumper, MovingBumper, PoisonMushroom, BlockButton, TogglePlatform, TriggerButton, Signboard, GhostPlatform, Respawn } from '../gimmicks';

/**
 * ObjectFactory
 * Tiled Object 데이터를 기반으로 실제 게임 기믹(Gimmick) 객체를 생성합니다.
 */
export default class ObjectFactory {

    public static createObject(
        scene: BaseGameScene,
        map: Phaser.Tilemaps.Tilemap,
        obj: Phaser.Types.Tilemaps.TiledObject,
        mapScale: number,
        worldOffsetY: number,
        parentClass?: string,
        parentOffsetX: number = 0,
        parentOffsetY: number = 0
    ): void {
        const width = (obj.width || 0) * mapScale;
        const height = (obj.height || 0) * mapScale;

        const gidRaw = obj.gid || 0;

        // 오프셋 적용 (Group Layer 상속값 포함)
        const scaledOffsetX = parentOffsetX * mapScale;
        const scaledOffsetY = parentOffsetY * mapScale;

        // Tiled Pivot (Rotation Center) Calculation
        // Tiled (x, y) coordinates essentially represent the Pivot point
        const pivotX = (obj.x || 0) * mapScale + scaledOffsetX;
        const pivotY = (obj.y || 0) * mapScale + scaledOffsetY + worldOffsetY;

        // Determine Unrotated Center Offset relative to Pivot
        let localOffsetX = 0;
        let localOffsetY = 0;

        if (gidRaw > 0) {
            // Tile Object (GID > 0): Pivot is Bottom-Left
            // Unrotated Center is (w/2, -h/2) relative to Pivot
            localOffsetX = width / 2;
            localOffsetY = -height / 2;
        } else {
            // Shape Object (Rectangle/Ellipse): Pivot is Top-Left
            // Unrotated Center is (w/2, h/2) relative to Pivot
            localOffsetX = width / 2;
            localOffsetY = height / 2;
        }

        // Apply Rotation to the Center Offset
        // Tiled & Phaser Rotation is Clockwise Positive (Degree)
        const rotationDeg = obj.rotation || 0;
        const rotationRad = Phaser.Math.DegToRad(rotationDeg);

        // Rotation Matrix for Clockwise rotation in screen coordinates (Y down)
        // x' = x * cos(θ) - y * sin(θ)
        // y' = x * sin(θ) + y * cos(θ)
        const cos = Math.cos(rotationRad);
        const sin = Math.sin(rotationRad);

        const rotatedOffsetX = localOffsetX * cos - localOffsetY * sin;
        const rotatedOffsetY = localOffsetX * sin + localOffsetY * cos;

        // Final Center Position
        const centerX = pivotX + rotatedOffsetX;
        const centerY = pivotY + rotatedOffsetY;

        const gid = gidRaw & ~(0x80000000 | 0x40000000 | 0x20000000 | 0x10000000); // GID flipping

        let texture = '';
        let frame = 0;
        if (gid > 0) {
            const tileset = map.tilesets.find(ts =>
                gid >= ts.firstgid && gid < ts.firstgid + ts.total
            );
            if (tileset) {
                texture = tileset.name;
                frame = gid - tileset.firstgid;
            }
        }

        const rotation = obj.rotation || 0;
        let type = obj.type || (obj as any).class;
        if (!type && parentClass) type = parentClass;

        // ... Type inference ...
        if (!type) {
            if (gid === 111 || gid === 131) type = 'Lock';
            else if (gid === 113) type = 'Goal';
            // [FIX] Relaxed Spawn detection: Check name case-insensitive
            else if (gid === 96 || gid === 30 || (obj.name && (obj.name.toLowerCase() === 'spawn' || obj.name.toLowerCase() === 'spawnpoint'))) type = 'Spawn';
            else if (TiledHelper.getObjectProperty(obj, 'collides') === true) type = 'Solid';
            else if (TiledHelper.getObjectProperty(obj, 'playerIndex') !== undefined || TiledHelper.getObjectProperty(obj, 'isDefault') !== undefined) type = 'Spawn';
            else if (TiledHelper.getObjectProperty(obj, 'targetX') !== undefined || TiledHelper.getObjectProperty(obj, 'targetY') !== undefined) {
                if (TiledHelper.getObjectProperty(obj, 'speed') !== undefined) type = 'MovingBumper';
                else type = 'Elevator';
            }
        }

        // Factory Logic
        switch (type) {
            case 'Spawn':
            case 'SpawnPoint': {
                const playerIndex = TiledHelper.getObjectProperty(obj, 'playerIndex');
                const isDefault = TiledHelper.getObjectProperty(obj, 'isDefault');
                const respawn = new Respawn(
                    scene,
                    centerX, centerY, `respawn-${obj.id}`, playerIndex !== undefined ? Number(playerIndex) : undefined, isDefault === true || isDefault === 'true',
                    texture, frame
                );
                respawn.setScale(mapScale);
                scene.spawnPoints.push(respawn);
                console.log(`[ObjectFactory] Spawn registered: (${centerX}, ${centerY})`);
                break;
            }
            case 'Signboard': {
                const message = TiledHelper.getObjectProperty(obj, 'message') || '내용이 없습니다.';
                scene.signboards.push(new Signboard(scene, {
                    id: obj.id!.toString(), x: centerX, y: centerY, message, width, height, texture, frame, angle: rotation
                }));
                break;
            }
            case 'Lock': {
                const doorId = TiledHelper.getObjectProperty(obj, 'doorId') || 1;
                const targetGoalId = TiledHelper.getObjectProperty(obj, 'targetGoalId');
                scene.locks.push(new Lock(scene, centerX, centerY, `lock-${doorId}`, width, height, texture, frame, rotation, targetGoalId));
                break;
            }
            case 'Key': {
                const doorId = TiledHelper.getObjectProperty(obj, 'doorId') || 1;
                scene.keys.push(new Key(scene, centerX, centerY, obj.id!.toString(), `lock-${doorId}`, width, height, texture, frame, rotation));
                break;
            }
            case 'MovableBlock': {
                const targetBlockId = TiledHelper.getObjectProperty(obj, 'targetBlockId');
                const reqPlayers = TiledHelper.getObjectProperty(obj, 'requiredPlayers') || 1;
                const block = new MovableBlock(scene, {
                    id: obj.id!.toString(), x: centerX, y: centerY, width, height, requiredPlayers: reqPlayers,
                    texture, frame, targetBlockId: targetBlockId
                });
                if (targetBlockId) block.setVisible(false);
                scene.movableBlocks.push(block);
                break;
            }
            case 'Goal': {
                const reqPlayers = TiledHelper.getObjectProperty(obj, 'requiredPlayers') || 1;
                const targetGoalId = TiledHelper.getObjectProperty(obj, 'targetGoalId');
                const goal = new Goal(scene, centerX, centerY, obj.id!.toString(), reqPlayers, width, height, texture, frame, rotation, targetGoalId);

                // [FIX] targetGoalId가 있는 경우(Lock에 의해 해금되는 경우)에만 숨김 처리
                if (targetGoalId) {
                    goal.setVisible(false);
                } else {
                    goal.setVisible(true);
                }

                scene.goals.push(goal);
                break;
            }
            case 'BlockButton': {
                const props = TiledHelper.getAllObjectProperties(obj);
                const targetBlockId = props.targetBlockId;
                const button = new BlockButton(scene, {
                    id: obj.id!.toString(), x: centerX, y: centerY, width, height, texture, frame,
                    targetBlockId: targetBlockId,
                    spawnConfig: targetBlockId ? undefined : {
                        id: `spawned-block-${obj.id}`,
                        x: (props.spawnX || 0) * mapScale,
                        y: (props.spawnY || 0) * mapScale + worldOffsetY,
                        width: (props.blockWidth || 16) * mapScale,
                        height: (props.blockHeight || 16) * mapScale,
                        requiredPlayers: props.requiredPlayers || 1,
                        texture: 'tiles_tileset', frame: 21
                    }
                });
                scene.blockButtons.push(button);
                break;
            }
            case 'Elevator': {
                const props = TiledHelper.getAllObjectProperties(obj);
                const collisionData = TiledHelper.getCollisionDataForGID(map, gid) || undefined;
                scene.elevators.push(new Elevator(scene, {
                    id: obj.id!.toString(), x: centerX, initialY: centerY,
                    targetY: (props.targetY || 0) * mapScale + worldOffsetY,
                    width, height, requiredPlayers: props.requiredPlayers || 1,
                    speed: props.speed, // Tiled Property 'speed'
                    texture, frame,
                    collisionData
                }));
                break;
            }
            case 'Spring': {
                const collisionData = TiledHelper.getCollisionDataForGID(map, gid) || undefined;
                scene.springs.push(new Spring(scene, centerX, centerY, obj.id!.toString(), -15, width, height, texture, frame, rotation, collisionData));
                break;
            }
            case 'Spike': {
                const collisionData = TiledHelper.getCollisionDataForGID(map, gid) || undefined;
                scene.spikes.push(new Spike(scene, centerX, centerY, obj.id!.toString(), width, height, texture, frame, rotation, collisionData));
                break;
            }
            case 'Bumper': {
                const props = TiledHelper.getAllObjectProperties(obj);
                const collisionData = TiledHelper.getCollisionDataForGID(map, gid) || undefined;
                scene.bumpers.push(new Bumper(scene, centerX, centerY, width, height, props.power, texture, frame, rotation, collisionData));
                break;
            }
            case 'PoisonMushroom':
            case 'Mushroom': {
                const collisionData = TiledHelper.getCollisionDataForGID(map, gid) || undefined;
                scene.poisonMushrooms.push(new PoisonMushroom(scene, centerX, centerY, obj.id!.toString(), width, height, texture, frame, rotation, collisionData));
                break;
            }
            case 'TogglePlatform': {
                scene.togglePlatforms.push(new TogglePlatform(scene, centerX, centerY, obj.id!.toString(), width, height));
                break;
            }
            case 'TriggerButton': {
                const props = TiledHelper.getAllObjectProperties(obj);
                scene.triggerButtons.push(new TriggerButton(scene, {
                    id: obj.id!.toString(), x: centerX, y: centerY, targetId: props.targetId || '',
                    width, height, oneTime: props.oneTime !== undefined ? props.oneTime : true
                }));
                break;
            }
            case 'GhostPlatform': {
                scene.ghostPlatforms.push(new GhostPlatform(scene, {
                    id: obj.id!.toString(), x: centerX, y: centerY, width, height, texture, frame
                }));
                break;
            }
            case 'MovingBumper': {
                const props = TiledHelper.getAllObjectProperties(obj);
                scene.movingBumpers.push(new MovingBumper(scene, {
                    id: obj.id!.toString(), startX: centerX, startY: centerY,
                    endX: props.targetX !== undefined ? props.targetX * mapScale : centerX,
                    endY: props.targetY !== undefined ? props.targetY * mapScale + worldOffsetY : centerY,
                    size: width, speed: props.speed || 0.002, power: props.power, offset: props.offset,
                    texture, frame, angle: rotation
                }));
                break;
            }
            case 'Solid': {
                scene.matter.add.rectangle(centerX, centerY, width, height, { isStatic: true, label: 'ground' });
                break;
            }
            case 'Respawn': {
                const props = TiledHelper.getAllObjectProperties(obj);
                const isDefault = props.isDefault === true;
                const playerIndex = props.playerIndex !== undefined ? props.playerIndex : undefined;

                const respawn = new Respawn(
                    scene,
                    centerX,
                    centerY,
                    obj.id!.toString(),
                    playerIndex,
                    isDefault,
                    texture,
                    frame
                );
                respawn.setScale(mapScale);
                scene.spawnPoints.push(respawn);
                console.log(`[ObjectFactory] Added Respawn: (${centerX}, ${centerY}), ID: ${obj.id}, P-Index: ${playerIndex}, Default: ${isDefault}`);
                break;
            }
        }
    }
}
